#!/bin/bash

if [ -z "$repo" ]; then
    repo=$PWD
fi

if [ -z "$packageVersion" ]; then
    packageVersion=0.0.0
fi

generatorType=typescript-fetch
openapiSpec=${repo}/openapi.json
updatedapiSpec=${repo}/modified_openapi.json
configSpec=${repo}/bindgen-config.json

openapiSpecUrl=$(cat ${configSpec} | json fetch.url)

# Pull down the current version of the spec
wget -q -O ${openapiSpec} ${openapiSpecUrl}

# Copy
cat ${openapiSpec} > ${updatedapiSpec}
preprocessCount=$(cat ${configSpec} | json generate.preprocess.length)
for (( i=0; i<$preprocessCount; i++))
do
    current=$(cat ${configSpec} | json generate.preprocess.$i)
    key=$(echo "${current}" | json key)
    type=$(echo "${current}" | json type)
    value=$(echo "${current}" | json value)
    valueIsString=$(echo "${current}" | json -e "console.log(typeof this.value === 'string')" | head -n 1)
    if [ $valueIsString = true ]; then
        value='"'${value}'"'
    fi
    if [ $type = remove ]; then
        json -I -f ${updatedapiSpec} -e 'try { this.'"${key}"'=undefined; } catch(err) { console.log("Could not remove key: '${key}'"); }'
        elif [ $type = update ]; then
        json -I -f ${updatedapiSpec} -e 'try { this.'"${key}"'='"${value}"'; } catch(err) { console.log("Could not update key: '${key}'"); }'
    else
        echo Unknown preprocessor replacement type "${type}" for key "${key}"
        exit 1
    fi
done
changedVersion=$(cat ${openapiSpec} | json info.version)

#npx @openapitools/openapi-generator-cli generate -i ${updatedapiSpec} -g ${generatorType} -o . >openapi.out

# Errors in openAPI Generator to work around
#       TS2741: Property 'jsonType' is missing in type 'BTDocumentSummaryInfo' but required in type 'BTGlobalTreeNodeInfo'.  -- FIXED by adding required jsonType and jsonType
#       TS2741: Property 'jsonType' is missing in type 'BTDocumentLabelInfo' but required in type 'BTGlobalTreeNodeInfo'.    -- FIXED by adding required jsonType and jsonType
#       TS2741: Property 'jsonType' is missing in type 'BTProjectInfo' but required in type 'BTGlobalTreeNodeInfo'.          -- FIXED by adding required jsonType and jsonType
#       TS2741: Property 'jsonType' is missing in type 'BTTeamSummaryInfo' but required in type 'BTGlobalTreeNodeInfo'.      -- FIXED by adding required jsonType and jsonType
#   Property 'btType' is optional in type 'BTFSValueArray1499' but required in type 'BTFSValue1888'.                         -- FIXED by adding required btType
#   Property 'btType' is optional in type 'BTFSValueBoolean1195' but required in type 'BTFSValue1888'.                       -- FIXED by adding required btType
#       TS2741: Property 'btType' is missing in type 'BTFSValueMap2062' but required in type 'BTFSValue1888'.                -- FIXED by adding required btType and btType
#   Property 'btType' is optional in type 'BTFSValueNumber772' but required in type 'BTFSValue1888'.                         -- FIXED by adding required btType
#   Property 'btType' is optional in type 'BTFSValueOther1124' but required in type 'BTFSValue1888'.                         -- FIXED by adding required btType
#   Property 'btType' is optional in type 'BTFSValueString1422' but required in type 'BTFSValue1888'.                        -- FIXED by adding required btType
#   Property 'btType' is optional in type 'BTFSValueTooBig1247' but required in type 'BTFSValue1888'.                        -- FIXED by adding required btType
#   Property 'btType' is optional in type 'BTFSValueUndefined2003' but required in type 'BTFSValue1888'.                     -- FIXED by adding required btType
#   Property 'btType' is optional in type 'BTFSValueWithUnits1817' but required in type 'BTFSValue1888'.                     -- FIXED by adding required btType
#       TS2307: Cannot find module './BTJEdit3734' or its corresponding type declarations.                                   -- FIXED by adding required btType and btType
#       TS2307: Cannot find module './BTParameterVisibilityCondition177' or its corresponding type declarations.             -- FIXED by adding required btType and btType
#   Property 'btType' is optional in type 'BTJEditChange2636' but required in type 'BTJEdit3734'.                            -- FIXED by adding required btType
#   Property 'btType' is optional in type 'BTJEditDelete1992' but required in type 'BTJEdit3734'.                            -- FIXED by adding required btType
#   Property 'btType' is optional in type 'BTJEditInsert2523' but required in type 'BTJEdit3734'.                            -- FIXED by adding required btType
#   Property 'btType' is optional in type 'BTJEditList2707' but required in type 'BTJEdit3734'.                              -- FIXED by adding required btType
#   Property 'btType' is optional in type 'BTJEditMove3245' but required in type 'BTJEdit3734'.                              -- FIXED by adding required btType
#       TS2741: Property 'jsonType' is missing in type 'BTDocumentInfo' but required in type 'BTDocumentSummaryInfo'.        -- FIXED by adding required jsonType and jsonType
#   Property 'btType' is optional in type 'BTParameterVisibilityAlwaysHidden176' but required in type 'BTParameterVisibilityCondition177'. -- FIXED by adding required btType
#   Property 'btType' is optional in type 'BTParameterVisibilityLogical178' but required in type 'BTParameterVisibilityCondition177'.      -- FIXED by adding required btType
#   Property 'btType' is optional in type 'BTParameterVisibilityOnEqual180' but required in type 'BTParameterVisibilityCondition177'.      -- FIXED by adding required btType
#   Property 'btType' is optional in type 'BTParameterVisibilityOnMateDOFType2114' but required in type 'BTParameterVisibilityOnEqual180'.  -- FIXED by adding required btType
#       TS2440: Import declaration conflicts with local declaration of 'BTInnerArrayParameterLocation2368FromJSONTyped'.     -- Fixed by deleting discriminator
#       TS2440: Import declaration conflicts with local declaration of 'BTMSketchCurveSegment155FromJSONTyped'.              -- Fixed by deleting discriminator
#       TS2440: Import declaration conflicts with local declaration of 'BTParameterVisibilityOnMateDOFType2114FromJSONTyped'.-- Fixed by deleting discriminator

