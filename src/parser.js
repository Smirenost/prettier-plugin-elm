"use strict";

const spawnSync = require("child_process").spawnSync;

function formatTextWithElmFormat(text) {
  const executionResult = spawnSync("elm-format", ["--stdin"], {
    input: text
  });

  const error = executionResult.stderr.toString();
  if (error) {
    throw new Error(error);
  }

  return executionResult;
}

/*
 * Simply passing text to elm-format is not enough because of two problems:
 *  
 * 1. If the code chunk contains no symbol assignments, elm-format fails.
 * 2. `module Main exposing (..)` is always added if no module has been defined,
 *    which is not wanted in markdown code blocks.
 * 
 * Both problems are related to https://github.com/avh4/elm-format/issues/65.
 * Until this upstream issue is fixed, two custom patches are applied:
 * 
 * 1. A temporary dummy statement is appended to text before sending it to elm-format.
 * 2. If elm-format's result defines a module while the source does not,
 *    module definition is trimmed while working with a markdown code block.
 * 
 * Please submit an issue to https://github.com/gicentre/prettier-plugin-elm/issues
 * if there are any problems caused by the patches.
 */

const dummyStatement = "\ndummyPrettierPluginElmSymbol = identity";
const dummyStatementRegExp = /\s*dummyPrettierPluginElmSymbol =\s+identity\n$/;
const autogeneratedModuleDefinitionRegExp = /[ \t]*module\s+Main\s+exposing\s+\(\s*\.\.\s*\)\s*/;

function parse(text, parsers, opts) {
  // patch 1 (step 1/2)
  const textToSend = `${text}${dummyStatement}`;

  // extract formatted text from elm-format
  const executionResult = formatTextWithElmFormat(textToSend);
  let formattedText = executionResult.stdout.toString();

  // path 1 (step 2/2)
  formattedText = formattedText.replace(dummyStatementRegExp, "\n");

  // patch 2
  if (
    opts.parentParser === "markdown" &&
    autogeneratedModuleDefinitionRegExp.test(formattedText) &&
    !autogeneratedModuleDefinitionRegExp.test(text)
  ) {
    formattedText = formattedText.replace(
      autogeneratedModuleDefinitionRegExp,
      ""
    );
  }

  // return an AST with a single node that contain all the formatted elm code;
  // no further splitting into smaller tokens is made
  return {
    ast_type: "elm-format",
    body: formattedText,
    comments: [],
    end: text.length,
    source: text,
    start: 0
  };
}

module.exports = parse;
