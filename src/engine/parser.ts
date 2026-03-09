import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

export interface Issue {
  id: string;
  type: 'complexity' | 'security' | 'style' | 'performance';
  message: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
  fix?: {
    range: [number, number];
    text: string;
  };
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

  if (language === 'python') {
    // Basic pattern matching for Python for now, as AST for Python in JS is limited without heavy libs
    return analyzePython(code);
  }

  return analyzeJSTS(code, language);
};

const analyzeJSTS = (code: string, language: string): ReviewResult => {
  const issues: Issue[] = [];
  let totalComplexity = 0;
  let securityRisks = 0;

  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: language === 'typescript' ? ['typescript', 'jsx'] : ['jsx'],
      errorRecovery: true,
    });

    traverse(ast, {
      // 1. Long functions & complexity
      Function(path) {
        const { start, end } = path.node.loc || { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } };
        const lineCount = end.line - start.line;
        if (lineCount > 50) {
          issues.push({
            id: `long-func-${start.line}`,
            type: 'complexity',
            message: `Function is too long (${lineCount} lines). Consider breaking it down.`,
            line: start.line,
            column: start.column,
            severity: 'warning'
          });
        }
        
        // Simple cyclomatic complexity estimation
        let complexity = 1;
        path.traverse({
          IfStatement: () => { complexity++; },
          SwitchCase: () => { complexity++; },
          ForStatement: () => { complexity++; },
          WhileStatement: () => { complexity++; },
          DoWhileStatement: () => { complexity++; },
          LogicalExpression: () => { complexity++; },
          ConditionalExpression: () => { complexity++; }
        });
        
        if (complexity > 10) {
          issues.push({
            id: `high-complexity-${start.line}`,
            type: 'complexity',
            message: `Function is highly complex (Complexity: ${complexity}).`,
            line: start.line,
            column: start.column,
            severity: 'warning'
          });
        }
        totalComplexity += complexity;
      },

      // 2. Security issues
      CallExpression(path) {
        if (t.isIdentifier(path.node.callee, { name: 'eval' })) {
          securityRisks++;
          issues.push({
            id: `security-eval-${path.node.loc?.start.line}`,
            type: 'security',
            message: 'Avoid using eval(). It is a dangerous security risk.',
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            severity: 'error'
          });
        }
      },

      AssignmentExpression(path) {
        if (
          t.isMemberExpression(path.node.left) &&
          t.isIdentifier(path.node.left.property, { name: 'innerHTML' })
        ) {
          securityRisks++;
          issues.push({
            id: `security-innerhtml-${path.node.loc?.start.line}`,
            type: 'security',
            message: 'Using innerHTML can lead to XSS vulnerabilities. Use textContent or DOM APIs.',
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            severity: 'warning'
          });
        }
      },

      // 3. Unused variables (basic check)
      VariableDeclarator(path) {
        const id = path.node.id;
        if (t.isIdentifier(id)) {
          const binding = path.scope.getBinding(id.name);
          if (binding && !binding.referenced) {
            issues.push({
              id: `unused-${id.name}`,
              type: 'style',
              message: `Variable "${id.name}" is declared but never used.`,
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0,
              severity: 'info',
              suggestion: 'Remove it.'
            });
          }
        }
      },

      // 5. var vs let/const
      VariableDeclaration(path) {
        if (path.node.kind === 'var') {
          issues.push({
            id: `var-usage-${path.node.loc?.start.line}`,
            type: 'style',
            message: 'Avoid "var". Use "let" or "const" instead.',
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            severity: 'info',
            suggestion: 'Change to "const".',
            fix: {
              range: [path.node.start || 0, (path.node.start || 0) + 3],
              text: 'const'
            }
          });
        }
      },
      ArrowFunctionExpression(path) {
        if (path.node.async && !t.isBlockStatement(path.node.body)) {
          // One-liner async might be fine but risky if not handled elsewhere
        } else if (path.node.async && t.isBlockStatement(path.node.body)) {
          const hasTry = path.node.body.body.some(stmt => t.isTryStatement(stmt));
          if (!hasTry) {
            issues.push({
              id: `missing-try-${path.node.loc?.start.line}`,
              type: 'performance',
              message: 'Async function missing try-catch block for error handling.',
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0,
              severity: 'warning'
            });
          }
        }
      }
    });

  } catch (e: any) {
    issues.push({
      id: 'parse-error',
      type: 'style',
      message: `Parse Error: ${e.message}`,
      line: e.loc?.line || 0,
      column: e.loc?.column || 0,
      severity: 'error'
    });
  }

  // Calculate score
  const baseScore = 100;
  const complexityPenalty = Math.min(totalComplexity * 2, 30);
  const securityPenalty = securityRisks * 25;
  const issuePenalty = issues.length * 5;
  const finalScore = Math.max(0, baseScore - complexityPenalty - securityPenalty - issuePenalty);

  return {
    score: Math.round(finalScore),
    issues,
    metrics: {
      complexity: Math.min(100, (totalComplexity / 5) * 10),
      maintainability: Math.round(finalScore),
      security: Math.max(0, 100 - securityRisks * 30)
    }
  };
};

const analyzePython = (code: string): ReviewResult => {
  const issues: Issue[] = [];
  // Lightweight pattern matching for Python
  const lines = code.split('\n');
  
  lines.forEach((line, index) => {
    if (line.includes('eval(')) {
      issues.push({ id: `py-eval-${index}`, type: 'security', message: 'Avoid eval() in Python.', line: index + 1, column: 1, severity: 'error' });
    }
    if (line.includes('exec(')) {
      issues.push({ id: `py-exec-${index}`, type: 'security', message: 'Avoid exec() in Python.', line: index + 1, column: 1, severity: 'error' });
    }
    if (line.trim().length > 120) {
      issues.push({ id: `py-long-line-${index}`, type: 'style', message: 'Line too long (>120 chars).', line: index + 1, column: 1, severity: 'info' });
    }
  });

  return {
    score: Math.max(0, 100 - issues.length * 10),
    issues,
    metrics: { complexity: 0, maintainability: 80, security: 90 }
  };
};
