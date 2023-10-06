const fs = require('fs');
const path = require('path');
const args = require('yargs').argv;

/**
 *
 * @param {string} content
 * @returns array[3] string of the content split out
 *         result[0] is the start of the file up to but not including the function definition
 *         result[1] is the actual function definition line
 *         result[2] is everything after the function definition line
 */
function splitoutTyped(content) {
    let result = content.split(/(export function \w+FromJSONTyped\(.*)/);
    if (result.length !== 3) {
        console.log(`ERROR: unable to find FromJSONTyped function`);
        return [content, '', ''];
    }

    // Now we need to find the closing } for the function.  Just split on all the remaining }
    // and join everything back together
    let pieces3 = result[2].split(/(\n}\n)/);
    if (pieces3.length === 1) {
        console.log(`ERROR: Unable to find closing } for function`);
        return result;
    }
    // The first two parts of the this third section get added to the second section
    result[1] += pieces3[0] + pieces3[1];
    result[2] = '';
    for (let i = 2; i < pieces3.length; i++) {
        result[2] += pieces3[i];
    }
    return result;
}

/**
 * Fix all the files in a given directory
 * @param {string} filesDir Directory path containing all the files to be processed
 */
function fixFiles(filesDir) {
    const references = {};
    const definitions = {};
    const usedrefs = {};
    const tofix = {};

    const reToJSON = new RegExp(/\.\.\.(\w+)ToJSON\(value\)/g);
    const reFunctionDef = new RegExp(/export function\s+(\w+ToJSON)\(value/g);

    // Get the list of files in the directory to process
    const files = fs.readdirSync(filesDir);

    // Walk through all the files
    for (const file of files) {
        const fullpath = path.join(filesDir, file);
        const content = fs.readFileSync(fullpath, 'utf-8');
        // Look for all the ToJSON references that we will have to change
        const found = content.matchAll(reToJSON);
        const items = [...found];
        if (items.length > 0) {
            const vals = [];
            for (const item of items) {
                const ref = item[1];
                vals.push(ref);
                usedrefs[ref + 'ToJSON'] = true;
            }
            references[fullpath] = vals;
            tofix[fullpath] = 'refs';
        }
        // Look for all the definitions that we will have to change
        const found2 = content.matchAll(reFunctionDef);
        const items2 = [...found2];
        if (items2.length > 0) {
            const vals = [];
            for (const item of items2) {
                vals.push(item[1]);
            }
            definitions[fullpath] = vals;
            if (tofix[fullpath] !== undefined) {
                tofix[fullpath] = 'both';
            } else {
                tofix[fullpath] = 'defs';
            }
        }
    }

    // Figure out which definitions we don't need to fix
    for (let deffile in definitions) {
        let actual = [];
        for (let def of definitions[deffile]) {
            if (usedrefs[def]) {
                actual.push(def);
            }
        }
        if (actual.length > 0) {
            definitions[deffile] = actual;
        } else {
            delete definitions[deffile];
            if (tofix[deffile] === 'defs') {
                delete tofix[deffile];
            } else if (tofix[deffile] === 'both') {
                tofix[deffile] = 'refs';
            }
        }
    }

    // We now have all the definitions/functions we need to replace.
    for (let file in tofix) {
        // Get the current contents of the file
        let content = fs.readFileSync(file, 'utf-8');
        // Fix up all the references
        if (references[file] !== undefined) {
            for (let ref of references[file]) {
                // Fix all the import references
                let re = new RegExp(` ${ref}ToJSON,`, 'g');
                content = content.replace(
                    re,
                    ` ${ref}ToJSON,\n ${ref}SuperToJSON,`
                );
                // Fix the actual reference
                let re2 = new RegExp(`\\.\\.\\.${ref}ToJSON`, 'g');
                content = content.replace(re2, `...${ref}SuperToJSON`);
            }
        }
        // Fix up all the definitions (which is much harder)
        if (definitions[file] !== undefined) {
            // find the export function FromJSONTyped( routine) and grab everything until the next line that starts export function
            // we are looking for lines that are like
            //                             if (json['btType'] === 'BTMDatabaseParameter-2229') {
            //                                 return BTMDatabaseParameter2229FromJSONTyped(json, true);
            //                             }
            //
            // These will be turned into
            //                             if (value.btType === 'BTMDatabaseParameter-2229') {
            //                                return BTMDatabaseParameter2229ToJSON(value);
            //                             }
            // By doing
            //      replace  /json\['(\w+)'\]/g, "value.$1"
            //      replace  /FromJSONTyped\(json, true/g, "ToJSON(value"
            // We also copy the Super function definition up to the {
            // export function BTMParameter1SuperToJSON(value?: BTMParameter1 | null): any {
            //      replace SuperToJSON with T
            //     return undefined;
            // }

            for (let def of definitions[file]) {
                // First we need to get rid of the "ToJSON" at the end of the string
                let basefunc = def.replace(/ToJSON$/, '');
                // Split the file into three parts.
                //  1 - Everything before the 'export function \w+FromJSONTyped(...)
                //  2 - The export function up to the closing } on the first line
                //  3 - Everything else

                let pieces = splitoutTyped(content);

                // First we want to get the name of the sub functions that we are calling
                // These are of the form:
                //               return BTMDatabaseParameter2229FromJSONTyped(json, true);
                // We will extract the name (dripping off the FromJSONTyped) to generate the
                // corresponding ToJSON function
                let subFunctMatches = [
                    ...pieces[1].matchAll(/return (\w+)FromJSONTyped\(/g),
                ];
                for (let subFuncMatch of subFunctMatches) {
                    let name = subFuncMatch[1];
                    // Add the entry to the reference
                    pieces[0] = pieces[0].replace(
                        `${name}FromJSONTyped`,
                        `${name}FromJSONTyped,\n    ${name}ToJSON`
                    );
                }
                // Pull out the information from the generated code
                //     calledFuncMatch[0] = overall matched string
                //     calledFuncMatch[1] = json element to match
                //     calledFuncMatch[2] = discriminator value to match
                //     calledFuncMatch[3] = Subfunction (without the FromJSONTyped) to call
                let calledFuncMatches = pieces[1].matchAll(
                    /if \(json\['(\w+)'\][^']*('[^']+').*\n *return (\w+)FromJSONTyped.*\);/g
                );
                let toJSONStmts = '';
                for (let calledFuncMatch of calledFuncMatches) {
                    toJSONStmts +=
                        `    if (value.${calledFuncMatch[1]} === ${calledFuncMatch[2]}) {\n` +
                        `        return ${calledFuncMatch[3]}ToJSON(value);\n` +
                        `    }\n`;
                }
                // Extract the line defining the function.
                const re3 = new RegExp(`export function ${def}.*{`);
                let f = pieces[2].match(re3);
                let newfun = '';
                if (f === null || f === undefined) {
                    console.log(
                        `ERROR: Unable to find function ${def} in ${file}`
                    );
                    newfun = `export function ${def}(value?:any|null): any{`;
                } else {
                    newfun = f[0];
                }
                // And fill in the function with the basic boiler plate
                newfun +=
                    `\n` +
                    `    if (value === undefined) {\n` +
                    `        return undefined;\n` +
                    `    }\n` +
                    `    if (value === null) {\n` +
                    `        return null;\n` +
                    `    }\n` +
                    `\n` +
                    toJSONStmts +
                    `    return ${basefunc}SuperToJSON(value);\n` +
                    `}\n`;
                // Rename the old base function to be the Super function
                pieces[2] = pieces[2].replace(
                    `${basefunc}ToJSON`,
                    `${basefunc}SuperToJSON`
                );
                content = pieces[0] + pieces[1] + pieces[2] + '\n\n' + newfun;
            }
        }
        console.log(`+Writing ${file}`);
        fs.writeFileSync(file, content);
    }
}

fixFiles(args.dir);
