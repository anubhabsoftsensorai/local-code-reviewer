import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';

const traverse = (typeof (_traverse as any).default === 'function')
  ? (_traverse as any).default
  : _traverse;

export interface Issue {
  id: string;
  type: 'complexity' | 'security' | 'style' | 'performance' | 'maintainability';
  message: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
  fix?: {
    range: [number, number];
    text: string;
  };
  lineContent?: string;
}

export interface ReviewResult {
  score: number;
  issues: Issue[];
  metrics: {
    complexity: number;
    maintainability: number;
    security: number;
  };
}

export const analyzeCode = (code: string, language: 'javascript' | 'typescript' | 'python' | 'json'): ReviewResult => {
  if (language === 'json') {
    try {
      JSON.parse(code);
      return { score: 100, issues: [], metrics: { complexity: 0, maintainability: 100, security: 100 } };
    } catch (e: any) {
      return {
        score: 0,
        issues: [{ id: 'json-invalid', type: 'style', message: e.message, line: 1, column: 1, severity: 'error' }],
        metrics: { complexity: 0, maintainability: 0, security: 100 }
      };
    }
  }

  if (language === 'python') return analyzePython(code);
  return analyzeJSTS(code, language);
};

// ─── JS / TS ────────────────────────────────────────────────────────────────

const analyzeJSTS = (code: string, language: string): ReviewResult => {
  const issues: Issue[] = [];
  const reportedLines = new Set<string>();  // deduplicate by type+line
  let totalComplexity = 0;
  let securityRisks = 0;

  const push = (issue: Issue) => {
    const key = `${issue.type}-${issue.line}`;
    if (!reportedLines.has(key)) {
      reportedLines.add(key);
      issues.push(issue);
    }
  };

  const sourceLines = code.split('\n');

  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: language === 'typescript' ? ['typescript', 'jsx'] : ['jsx'],
      errorRecovery: true,
    });

    traverse(ast, {

      // ── Complexity ───────────────────────────────────────────────────────

      Function(path: any) {
        const loc = path.node.loc;
        if (!loc) return;
        const { start, end } = loc;
        const lineCount = end.line - start.line;

        // Long function
        if (lineCount > 50) {
          push({
            id: `long-func-${start.line}`,
            type: 'complexity',
            message: `Function is too long (${lineCount} lines). Consider splitting it.`,
            line: start.line, column: start.column, severity: 'warning',
            suggestion: 'Extract logical blocks into smaller, named helper functions.',
          });
        }

        // Too many parameters
        if (path.node.params.length > 5) {
          push({
            id: `too-many-params-${start.line}`,
            type: 'complexity',
            message: `Function has ${path.node.params.length} parameters (max recommended: 5).`,
            line: start.line, column: start.column, severity: 'warning',
            suggestion: 'Consider grouping related parameters into an options object.',
          });
        }

        // Cyclomatic complexity
        let complexity = 1;
        path.traverse({
          IfStatement: () => { complexity++; },
          SwitchCase: (p: any) => { if (p.node.test) complexity++; },
          ForStatement: () => { complexity++; },
          ForInStatement: () => { complexity++; },
          ForOfStatement: () => { complexity++; },
          WhileStatement: () => { complexity++; },
          DoWhileStatement: () => { complexity++; },
          LogicalExpression: () => { complexity++; },
          ConditionalExpression: () => { complexity++; },
          CatchClause: () => { complexity++; },
        });
        if (complexity > 10) {
          push({
            id: `high-complexity-${start.line}`,
            type: 'complexity',
            message: `Function is highly complex (Cyclomatic: ${complexity}).`,
            line: start.line, column: start.column, severity: 'warning',
            suggestion: 'Reduce branching by extracting conditions into well-named predicates.',
          });
        }
        totalComplexity += complexity;

        // Deep nesting
        let maxNestDepth = 0;
        let deepestLine = start.line;
        path.traverse({
          'IfStatement|ForStatement|ForInStatement|ForOfStatement|WhileStatement|DoWhileStatement'(innerPath: any) {
            let depth = 0;
            let p = innerPath.parentPath;
            while (p && p !== path) {
              if (
                t.isIfStatement(p.node) || t.isForStatement(p.node) ||
                t.isForInStatement(p.node) || t.isForOfStatement(p.node) ||
                t.isWhileStatement(p.node) || t.isDoWhileStatement(p.node)
              ) depth++;
              p = p.parentPath;
            }
            if (depth > maxNestDepth) {
              maxNestDepth = depth;
              deepestLine = innerPath.node.loc?.start.line || start.line;
            }
          },
        });
        if (maxNestDepth > 3) {
          push({
            id: `deep-nest-${start.line}`,
            type: 'complexity',
            message: `Deeply nested code detected (depth: ${maxNestDepth + 1}).`,
            line: deepestLine, column: 0, severity: 'warning',
            suggestion: 'Use early returns or extract inner blocks into helper functions.',
          });
        }

        // Async missing try-catch (covers all function types)
        if (path.node.async && t.isBlockStatement(path.node.body)) {
          const hasTry = path.node.body.body.some((s: any) => t.isTryStatement(s));
          if (!hasTry) {
            push({
              id: `missing-try-${start.line}`,
              type: 'maintainability',
              message: 'Async function missing try-catch block.',
              line: start.line, column: start.column, severity: 'warning',
              suggestion: 'Wrap the async body in try-catch to handle rejected promises.',
            });
          }
        }
      },

      // ── Security ─────────────────────────────────────────────────────────

      CallExpression(path: any) {
        const loc = path.node.loc?.start;
        const line = loc?.line || 0;
        const col  = loc?.column || 0;

        // eval()
        if (t.isIdentifier(path.node.callee, { name: 'eval' })) {
          securityRisks++;
          push({
            id: `sec-eval-${line}`, type: 'security',
            message: 'Avoid eval() — it enables arbitrary code execution.',
            line, column: col, severity: 'error',
            suggestion: 'Use JSON.parse() for data or redesign to avoid dynamic code.',
          });
        }

        // document.write()
        if (
          t.isMemberExpression(path.node.callee) &&
          t.isIdentifier((path.node.callee as any).object, { name: 'document' }) &&
          t.isIdentifier((path.node.callee as any).property, { name: 'write' })
        ) {
          securityRisks++;
          push({
            id: `sec-docwrite-${line}`, type: 'security',
            message: 'Avoid document.write() — blocks parsing and is an XSS vector.',
            line, column: col, severity: 'error',
            suggestion: 'Use DOM manipulation methods like appendChild or innerHTML safely.',
          });
        }

        // setTimeout / setInterval with string arg
        const calleeName = t.isIdentifier(path.node.callee) ? path.node.callee.name : '';
        if (
          (calleeName === 'setTimeout' || calleeName === 'setInterval') &&
          path.node.arguments.length > 0 &&
          t.isStringLiteral(path.node.arguments[0])
        ) {
          securityRisks++;
          push({
            id: `sec-settimeout-str-${line}`, type: 'security',
            message: `${calleeName}() called with a string — behaves like eval().`,
            line, column: col, severity: 'error',
            suggestion: 'Pass a function reference instead of a string.',
          });
        }

        // console.* left in code
        if (
          t.isMemberExpression(path.node.callee) &&
          t.isIdentifier((path.node.callee as any).object, { name: 'console' })
        ) {
          const method = ((path.node.callee as any).property as any)?.name || '';
          if (['log', 'debug', 'info', 'warn', 'error'].includes(method)) {
            push({
              id: `perf-console-${line}`, type: 'performance',
              message: `console.${method}() left in production code.`,
              line, column: col, severity: 'info',
              suggestion: 'Remove or replace with a proper logging library before shipping.',
            });
          }
        }

        // Promise without .catch() — standalone .then() with no .catch() chained
        if (
          t.isMemberExpression(path.node.callee) &&
          t.isIdentifier((path.node.callee as any).property, { name: 'then' }) &&
          !t.isCallExpression(path.parentPath?.node)
        ) {
          push({
            id: `unhandled-promise-${line}`, type: 'maintainability',
            message: 'Promise .then() without a .catch() — unhandled rejection possible.',
            line, column: col, severity: 'warning',
            suggestion: 'Chain .catch() or use async/await with try-catch.',
          });
        }
      },

      AssignmentExpression(path: any) {
        const loc = path.node.loc?.start;
        const line = loc?.line || 0;
        const col  = loc?.column || 0;

        const left = path.node.left;
        if (!t.isMemberExpression(left)) return;
        const prop = (left.property as any)?.name;

        // innerHTML / outerHTML
        if (prop === 'innerHTML' || prop === 'outerHTML') {
          securityRisks++;
          push({
            id: `sec-${prop}-${line}`, type: 'security',
            message: `Assigning to ${prop} is an XSS risk.`,
            line, column: col, severity: 'warning',
            suggestion: 'Use textContent for plain text, or sanitize HTML with DOMPurify.',
          });
        }
      },

      // Hardcoded credentials
      VariableDeclarator(path: any) {
        const name: string = (path.node.id as any)?.name || '';
        const line = path.node.loc?.start.line || 0;
        const col  = path.node.loc?.start.column || 0;

        // Unused variable
        const binding = path.scope.getBinding(name);
        if (binding && !binding.referenced) {
          push({
            id: `unused-${name}-${line}`, type: 'style',
            message: `Variable "${name}" is declared but never used.`,
            line, column: col, severity: 'info',
            suggestion: 'Remove unused variables to reduce cognitive load.',
          });
        }

        // Hardcoded credential
        if (
          /password|passwd|secret|apikey|api_key|authtoken|auth_token|private_key/i.test(name) &&
          t.isStringLiteral(path.node.init) &&
          (path.node.init as any).value.length > 0
        ) {
          securityRisks++;
          push({
            id: `sec-hardcoded-${line}`, type: 'security',
            message: `Hardcoded credential detected in "${name}".`,
            line, column: col, severity: 'error',
            suggestion: 'Load secrets from environment variables or a secrets manager.',
          });
        }
      },

      // ── Style / Maintainability ───────────────────────────────────────────

      // var usage
      VariableDeclaration(path: any) {
        if (path.node.kind === 'var') {
          const line = path.node.loc?.start.line || 0;
          push({
            id: `no-var-${line}`, type: 'style',
            message: '`var` declaration — prefer `const` or `let`.',
            line, column: path.node.loc?.start.column || 0, severity: 'warning',
            suggestion: 'Use `const` for values that never reassign, `let` otherwise.',
          });
        }
      },

      // == instead of ===
      BinaryExpression(path: any) {
        if (path.node.operator === '==' || path.node.operator === '!=') {
          const line = path.node.loc?.start.line || 0;
          push({
            id: `eqeq-${line}`, type: 'style',
            message: `Loose equality \`${path.node.operator}\` used. Prefer \`${path.node.operator}=\`.`,
            line, column: path.node.loc?.start.column || 0, severity: 'warning',
            suggestion: 'Strict equality avoids unexpected type coercion bugs.',
          });
        }
      },

      // Empty catch block
      CatchClause(path: any) {
        const body = path.node.body.body;
        if (body.length === 0) {
          const line = path.node.loc?.start.line || 0;
          push({
            id: `empty-catch-${line}`, type: 'maintainability',
            message: 'Empty catch block — errors are silently swallowed.',
            line, column: path.node.loc?.start.column || 0, severity: 'warning',
            suggestion: 'Log or rethrow the error, or add an explanatory comment.',
          });
        }
      },

      // dangerouslySetInnerHTML (React)
      JSXAttribute(path: any) {
        if ((path.node.name as any)?.name === 'dangerouslySetInnerHTML') {
          const line = path.node.loc?.start.line || 0;
          securityRisks++;
          push({
            id: `sec-dsihtml-${line}`, type: 'security',
            message: 'dangerouslySetInnerHTML bypasses React\'s XSS protection.',
            line, column: path.node.loc?.start.column || 0, severity: 'error',
            suggestion: 'Sanitize content with DOMPurify before passing it.',
          });
        }
      },

      // TypeScript `any`
      TSAnyKeyword(path: any) {
        const line = path.node.loc?.start.line || 0;
        push({
          id: `ts-any-${line}`, type: 'style',
          message: 'Explicit `any` type disables TypeScript\'s type safety.',
          line, column: path.node.loc?.start.column || 0, severity: 'info',
          suggestion: 'Use a specific type, `unknown`, or a generic instead.',
        });
      },

      // Magic numbers — only flag large, clearly-suspicious values (>= 100)
      // Small numbers (0-99) are almost always intentional thresholds or indices.
      NumericLiteral(path: any) {
        const val = path.node.value;
        if (Math.abs(val) < 100) return;
        const parent = path.parentPath?.node;
        // Skip all declarative / structural contexts
        if (
          t.isVariableDeclarator(parent) ||
          t.isTSEnumMember(parent) ||
          t.isObjectProperty(parent) ||
          t.isAssignmentPattern(parent) ||
          t.isArrayExpression(parent) ||
          t.isReturnStatement(parent) ||
          t.isBinaryExpression(parent) ||   // comparison thresholds: x > 100
          t.isUnaryExpression(parent)        // negation: -200
        ) return;
        const line = path.node.loc?.start.line || 0;
        push({
          id: `magic-num-${line}-${val}`, type: 'maintainability',
          message: `Magic number \`${val}\` — extract to a named constant.`,
          line, column: path.node.loc?.start.column || 0, severity: 'info',
          suggestion: `const MEANINGFUL_NAME = ${val};`,
        });
      },

    });

    // ── Source-level checks (regex on lines) ─────────────────────────────

    const todoRe = /\b(TODO|FIXME|HACK|XXX|BUG)\b/;
    sourceLines.forEach((line, i) => {
      const match = line.match(todoRe);
      if (match) {
        push({
          id: `todo-${i}`, type: 'style',
          message: `${match[1]} comment found — should be resolved before shipping.`,
          line: i + 1, column: 0, severity: 'info',
        });
      }
    });

    // Long file
    if (sourceLines.length > 300) {
      push({
        id: 'long-file', type: 'complexity',
        message: `File is ${sourceLines.length} lines long. Consider splitting it.`,
        line: 1, column: 0, severity: 'warning',
        suggestion: 'Break the file into focused modules with single responsibilities.',
      });
    }

  } catch (e: any) {
    issues.push({ id: 'parse-err', type: 'style', message: e.message, line: e.loc?.line || 0, column: e.loc?.column || 0, severity: 'error' });
  }

  // Attach line content
  issues.forEach(issue => {
    if (issue.line > 0 && issue.line <= sourceLines.length) {
      issue.lineContent = sourceLines[issue.line - 1].trim();
    }
  });

  const errorCount   = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount    = issues.filter(i => i.severity === 'info').length;

  const finalScore = Math.max(0, 100
    - errorCount   * 20
    - warningCount * 8
    - infoCount    * 2
    - securityRisks * 15
  );

  return {
    score: Math.round(finalScore),
    issues,
    metrics: {
      complexity:      Math.min(100, totalComplexity * 5),
      maintainability: Math.round(finalScore),
      security:        Math.max(0, 100 - securityRisks * 25),
    },
  };
};

// ─── Python (regex-based) ────────────────────────────────────────────────────

const analyzePython = (code: string): ReviewResult => {
  const issues: Issue[] = [];
  const lines = code.split('\n');

  const push = (issue: Issue) => issues.push(issue);

  lines.forEach((raw, i) => {
    const line = raw.trim();
    const ln = i + 1;

    // Security
    if (/\beval\s*\(/.test(line))
      push({ id: `py-eval-${i}`, type: 'security', message: 'Avoid eval() — arbitrary code execution risk.', line: ln, column: 1, severity: 'error', lineContent: line, suggestion: 'Redesign to avoid dynamic code evaluation.' });

    if (/\bexec\s*\(/.test(line))
      push({ id: `py-exec-${i}`, type: 'security', message: 'Avoid exec() — arbitrary code execution risk.', line: ln, column: 1, severity: 'error', lineContent: line, suggestion: 'Use subprocess or safer alternatives.' });

    if (/\bos\.system\s*\(/.test(line))
      push({ id: `py-ossys-${i}`, type: 'security', message: 'os.system() is a shell injection risk.', line: ln, column: 1, severity: 'warning', lineContent: line, suggestion: 'Use subprocess.run() with a list of arguments.' });

    if (/subprocess.*shell\s*=\s*True/.test(line))
      push({ id: `py-subshell-${i}`, type: 'security', message: 'subprocess with shell=True enables shell injection.', line: ln, column: 1, severity: 'error', lineContent: line, suggestion: 'Pass a list of args and set shell=False.' });

    if (/\bpickle\.loads?\s*\(/.test(line))
      push({ id: `py-pickle-${i}`, type: 'security', message: 'pickle.load() can execute arbitrary code on untrusted data.', line: ln, column: 1, severity: 'error', lineContent: line, suggestion: 'Use JSON or a safe serialization format for untrusted sources.' });

    // Style / maintainability
    if (raw.length > 120)
      push({ id: `py-len-${i}`, type: 'style', message: `Line too long (${raw.length} chars, limit 120).`, line: ln, column: 1, severity: 'info', lineContent: line });

    if (/^\s*global\s+/.test(raw))
      push({ id: `py-global-${i}`, type: 'maintainability', message: 'Global variable usage — reduces modularity.', line: ln, column: 1, severity: 'warning', lineContent: line, suggestion: 'Pass values explicitly via function arguments.' });

    if (/^\s*except\s*:/.test(raw) || /^\s*except\s+Exception\s*:/.test(raw))
      push({ id: `py-bare-except-${i}`, type: 'maintainability', message: 'Bare except clause — catches all exceptions including SystemExit.', line: ln, column: 1, severity: 'warning', lineContent: line, suggestion: 'Catch specific exception types.' });

    if (/^\s*pass\s*$/.test(raw) && i > 0 && /except/.test(lines[i - 1]))
      push({ id: `py-empty-except-${i}`, type: 'maintainability', message: 'Empty except block silently swallows exceptions.', line: ln, column: 1, severity: 'warning', lineContent: line });

    // Performance / debug
    if (/^\s*print\s*\(/.test(raw))
      push({ id: `py-print-${i}`, type: 'performance', message: 'print() left in code — use a logging framework instead.', line: ln, column: 1, severity: 'info', lineContent: line });

    // TODO / FIXME
    const todoMatch = line.match(/\b(TODO|FIXME|HACK|XXX|BUG)\b/);
    if (todoMatch)
      push({ id: `py-todo-${i}`, type: 'style', message: `${todoMatch[1]} comment should be resolved.`, line: ln, column: 1, severity: 'info', lineContent: line });
  });

  // Long file
  if (lines.length > 300)
    push({ id: 'py-long-file', type: 'complexity', message: `File is ${lines.length} lines. Consider splitting into modules.`, line: 1, column: 0, severity: 'warning' });

  const errorCount   = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount    = issues.filter(i => i.severity === 'info').length;
  const securityRisks = issues.filter(i => i.type === 'security').length;

  const score = Math.max(0, 100 - errorCount * 20 - warningCount * 8 - infoCount * 2);

  return {
    score,
    issues,
    metrics: {
      complexity:      Math.min(100, issues.filter(i => i.type === 'complexity').length * 20),
      maintainability: score,
      security:        Math.max(0, 100 - securityRisks * 25),
    },
  };
};
