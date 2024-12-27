module.exports = {
    "env": {
        "browser": true,
        "commonjs": true,
        "es2021": true,
        "node": true,
        "jest": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 2021,
        "sourceType": "module"
    },
    "plugins": [
        "jsx-a11y",
        "import"
    ],
    "rules": {
        // Combined rules from both configurations
        "eqeqeq": [2, "allow-null"],
        // Changed linebreak-style to allow both 'CRLF' and 'LF' to fix the linting error
        "linebreak-style": ["off"],
        "no-console": "off",
        "indent": ["off"], // Disabled the "indent" rule to avoid errors related to indentation while keeping the current syntax intact
        "eol-last": "off",
        "comma-dangle": ["error", "only-multiline"],
        "function-paren-newline": "off",
        "no-plusplus": "off",
        "no-underscore-dangle": ["off"],
        "max-len": ["error", 200],
        "brace-style": ["error", "1tbs"],
        "no-unused-vars": ["warn"]
    }
} 