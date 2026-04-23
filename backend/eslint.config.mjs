import js from "@eslint/js";
import nodePlugin from "eslint-plugin-n";
import globals from "globals";

/**
 * @file eslint.config.mjs
 * @description ESLint 9 Flat Configuration for Compari Backend.
 * @responsibility Enforces code quality and Node.js best practices.
 * @separation_of_concerns Isolates linting rules from application logic.
 */
export default [
  js.configs.recommended,
  nodePlugin.configs["flat/recommended-script"],
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.commonjs,
      },
    },
    rules: {
      "no-unused-vars": ["warn", {"argsIgnorePattern": "^_|next", "varsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_"}],
      "no-console": "error",
      "n/no-unsupported-features/es-syntax": "off",
      "n/no-unsupported-features/node-builtins": "off",
      "n/no-missing-require": "error",
      "no-process-exit": "off",
      "n/no-process-exit": "off",
      "no-useless-escape": "off",
      "no-control-regex": "off",
      "no-empty": "warn"
    },
  },
  {
    // Domain Layer Architectural Boundaries
    files: [
      "src/controllers/**/*.js",
      "src/services/**/*.js",
      "src/workflows/**/*.js",
      "src/repositories/**/*.js"
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        // 1. Enforce Logging 'errorObj' requirement (Moved from global to apply to all domain code)
        {
          "selector": "CallExpression[callee.property.name='logSystemFault'] > ObjectExpression:not(:has(Property[key.name='errorObj']))",
          "message": "ARCHITECTURE VIOLATION: logSystemFault must include the 'errorObj' property to prevent swallowed stack traces. If no error object exists, explicitly pass 'errorObj: null'."
        },
        {
          "selector": "CatchClause CallExpression[callee.property.name='logTerminal'] > ObjectExpression:not(:has(Property[key.name='errorObj']))",
          "message": "ARCHITECTURE VIOLATION: logTerminal called inside a catch block must include the 'errorObj' property to preserve the stack trace."
        },
        // 2. Strict DI Enforcement: Ban manual requires of other domain classes
        {
          "selector": "CallExpression[callee.name='require'] > Literal[value=/(services|repositories|workflows|controllers)\\//]",
          "message": "ARCHITECTURE VIOLATION (Rule 2): Do not use require() to load other services, repositories, or workflows. You MUST use Awilix Constructor Injection."
        },
        // 3. Service Locator Ban: Ban fetching the DI container inside domain classes
        {
          "selector": "CallExpression > MemberExpression > Identifier[name='getContainer']",
          "message": "ARCHITECTURE VIOLATION (Rule 2): The Service Locator pattern is forbidden here. Inject your dependencies via the constructor instead of calling getContainer()."
        },
        // Ban Defensive Getters for Dependencies (Rule 2)
        {
          "selector": "MethodDefinition[kind='get']",
          "message": "ARCHITECTURE VIOLATION (Rule 2): Defensive getters (e.g., get _repo()) are STRICTLY FORBIDDEN. Store dependencies directly on 'this' via Constructor Injection."
        },
        // Consolidate Faults (Rule 1): Ban logErrorFile outside of LogService.js
        {
          "selector": "CallExpression[callee.property.name='logErrorFile'][callee.object.type!='ThisExpression']",
          "message": "ARCHITECTURE VIOLATION (Rule 1): Do not call logErrorFile directly from injected services. You MUST use logService.logSystemFault({ origin, message, errorObj }) to ensure faults are printed to the terminal and logged to disk simultaneously."
        },
        // Ban Synchronous File I/O outside of boot sequence (Performance)
        {
          "selector": "CallExpression > MemberExpression[object.name='fs'][property.name=/Sync$/]",
          "message": "ARCHITECTURE VIOLATION (Performance): Synchronous file I/O blocks the Node.js event loop. You MUST use async fs.promises methods for runtime operations."
        },
        // Require JSDoc architectural tags on Classes (Rule 6)
        {
          "selector": "Program > ClassDeclaration",
          "message": "ARCHITECTURE VIOLATION (Rule 6): All Domain Classes MUST have a JSDoc block containing @responsibility and @boundary_rules to explain their architectural placement."
        },
        // Ban floating promises on async file operations (Missing await when assigned to variable)
        {
          "selector": "VariableDeclarator > CallExpression[callee.property.name=/^(readBuffer|saveBuffer|getFileBuffer|moveFile|readTextFile|saveTextFile|generateAndSaveMasterDocument)$/]",
          "message": "ARCHITECTURE VIOLATION: Floating Promise detected. You MUST use 'await' when calling async file/document methods."
        },
        // Ban floating promises on async file operations (Missing await when executed standalone)
        {
          "selector": "ExpressionStatement > CallExpression[callee.property.name=/^(readBuffer|saveBuffer|getFileBuffer|moveFile|readTextFile|saveTextFile|generateAndSaveMasterDocument)$/]",
          "message": "ARCHITECTURE VIOLATION: Floating Promise detected. You MUST use 'await' when calling async file/document methods."
        }
      ]
    }
  },
  {
    // System-Wide DTO Enforcement
    files: [
      "src/controllers/**/*.js",
      "src/services/**/*.js",
      "src/workflows/**/*.js",
      "src/repositories/**/*.js"
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        // Enforce Anti-Parameter Creep (Rule 4)
        {
          "selector": "FunctionDeclaration[params.length>3], FunctionExpression[params.length>3], ArrowFunctionExpression[params.length>3]",
          "message": "ARCHITECTURE VIOLATION (Rule 4): Anti-Parameter Creep. Methods requiring more than 3 parameters MUST use a single DTO (Data Transfer Object) to stabilize the function signature."
        }
      ]
    }
  },
  {
    // Controller & Workflow Specific Boundaries
    files: [
      "src/controllers/**/*.js",
      "src/workflows/**/*.js"
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        // 4. "Tell, Don't Ask": Ban path.join in Orchestrators
        {
          "selector": "CallExpression[callee.object.name='path'][callee.property.name='join']",
          "message": "ARCHITECTURE VIOLATION (Rule 4): Workflows and Controllers MUST NOT manually construct file paths using path.join. Delegate to BaseEntityService.resolveEntityFilePath(id, fileName) or similar methods."
        },
        // Ban hidden I/O imports (Rule 2)
        {
          "selector": "CallExpression[callee.name='require'] > Literal[value='fs']",
          "message": "ARCHITECTURE VIOLATION (Rule 2): Hidden I/O dependencies are forbidden in Orchestrators. All file system operations must be routed through the injected FileService."
        },
        // Ban direct addActivityLog to prevent path leakage (Rule 3)
        {
          "selector": "CallExpression[callee.property.name='addActivityLog']",
          "message": "ARCHITECTURE VIOLATION (Rule 3): Do not call LogService.addActivityLog directly to prevent absolute path leakage. Use the entity service wrapper (e.g., this._entityService.logActivity(id, dto))."
        },
        // Ban Presentation Logic in Orchestrators (Rule 4)
        {
          "selector": "CallExpression[callee.object.name='MarkdownGenerator']",
          "message": "ARCHITECTURE VIOLATION (Rule 4): NO manual markdown stitching outside of Domain Services. Delegate presentation logic to the Domain Service (e.g., this._entityService.generateAndSaveMasterDocument)."
        }
      ]
    }
  },
  {
    // Workflow Specific Boundaries
    files: [
      "src/workflows/**/*.js"
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        // 5. AI Concurrency Encapsulation: Ban processAiTasks in Workflows
        {
          "selector": "CallExpression[callee.name='processAiTasks'], CallExpression[callee.property.name='processAiTasks']",
          "message": "ARCHITECTURE VIOLATION (Rule 4): Workflows MUST NOT manually manage AI concurrency using processAiTasks. Delegate to this._aiService.executeParallelTasks()."
        },
        // 7. "Tell, Don't Ask": Ban entity fetching in Workflows
        {
          "selector": "CallExpression > MemberExpression[property.name=/^get(Entity|Match|Criterion)ById$/]",
          "message": "ARCHITECTURE VIOLATION (Rule 7): 'Tell, Don't Ask'. Workflows MUST NOT fetch full entities just to extract primitive strings. Pass the ID to the target Domain Service and let the Service encapsulate the data resolution."
        }
      ]
    }
  },
  {
    // Controller Specific Boundaries
    files: [
      "src/controllers/**/*.js"
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        // Ban manual req.params.id extraction (Rule 8.B)
        {
          "selector": "MemberExpression[object.type='MemberExpression'][object.object.name='req'][object.property.name='params'][property.name='id']",
          "message": "ARCHITECTURE VIOLATION (Rule 8.B): Manual req.params.id extraction is forbidden to prevent boilerplate. You MUST use this._extractId(req) instead."
        },
        // Ban passing req.body directly to functions (Rule 4 DTO Encapsulation)
        {
          "selector": "CallExpression > MemberExpression[object.name='req'][property.name='body']",
          "message": "ARCHITECTURE VIOLATION (Rule 4): Do not pass req.body directly to Services. Controllers MUST explicitly extract and construct a DTO to decouple the Service from the HTTP transport layer."
        },
        // Ban manual 500 status codes (Rule 1.B)
        {
          "selector": "CallExpression[callee.property.name='status'] > Literal[value=500]",
          "message": "ARCHITECTURE VIOLATION (Rule 1.B): Do not manually send 500 status codes. Throw an AppError or pass the error to next(err) for centralized Global Error Handling."
        },
        // Ban OS-level file sending
        {
          "selector": "CallExpression > MemberExpression[object.name='res'][property.name=/^(sendFile|download)$/]",
          "message": "ARCHITECTURE VIOLATION: Controllers MUST NOT use OS-level file sending methods like res.sendFile() or res.download(). Delegate to the centralized handleFileDownload utility."
        }
      ]
    }
  },
  {
    // Repository Specific Boundaries
    files: [
      "src/repositories/**/*.js"
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        // Ban Hardcoded DB Connections (Rule 1.E)
        {
          "selector": "CallExpression[callee.name='require'] > Literal[value=/database/i]",
          "message": "ARCHITECTURE VIOLATION (Rule 1.E): Repositories MUST NOT hardcode the database connection via require. You MUST accept the 'db' instance via Constructor Injection."
        },
        // Ban Event Emissions in Repositories (Rule 1.E)
        {
          "selector": "CallExpression[callee.property.name='emit']",
          "message": "ARCHITECTURE VIOLATION (Rule 1.E): Repositories are pure Data Access Layers and MUST NOT emit domain events. Event emission belongs in the Domain Service layer."
        }
      ]
    }
  },
  {
    // Pure Utility Boundaries
    files: [
      "src/utils/**/*.js"
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        // Ban Domain Dependencies in Utilities (Rule 7)
        {
          "selector": "CallExpression[callee.name='require'] > Literal[value=/(services|repositories|workflows|controllers)\\//]",
          "message": "ARCHITECTURE VIOLATION (Rule 7): Utilities must be pure and stateless. They MUST NOT require Domain Services, Repositories, Workflows, or Controllers. Pass required data as arguments."
        }
      ]
    }
  },
  {
    // Test Files Configuration
    files: ["**/*.test.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        vi: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
    },
    rules: {
      "n/no-unpublished-import": ["error", { "allowModules": ["vitest"] }]
    }
  },
];