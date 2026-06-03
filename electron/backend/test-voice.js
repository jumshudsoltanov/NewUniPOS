const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function test() {
    try {
        const form = new FormData();
        // Create a dummy file
        fs.writeFileSync('dummy.webm', 'dummy data');
        form.append('audio', fs.createReadStream('dummy.webm'));
        form.append('menu', JSON.stringify([{id: 1, name: 'Test'}]));

        const response = await axios.post('http://127.0.0.1:55667/api/voice-order', form, {
            headers: form.getHeaders()
        });
        console.log("Success:", response.data);
    } catch (error) {
        if (error.response) {
            console.error("Error Status:", error.response.status);
            console.error("Error Data:", error.response.data);
        } else {
            console.error("Error:", error.message);
        }
    }
}
test();
