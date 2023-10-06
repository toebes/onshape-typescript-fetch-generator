const { exec } = require('child_process');

// Replace 'script.sh' with the name of your bash script
const script = exec('bash gen_modified_openapi.sh');

// Log the output of the script
script.stdout.on('data', (data) => {
    console.log(data.toString());
});

// Log any errors that occur while running the script
script.stderr.on('data', (data) => {
    console.error(data.toString());
});
