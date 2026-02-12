const https = require('https');

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzD8N0hjrH9gZvF6IGid8ligeYlOg6fX38rj5bQiQH8uoYa11mn8eymCuUPmF5DRME8/exec";

const orderData = {
    clientName: "Test Debugger",
    clientEmail: "test@debug.com",
    orderDetail: "SKU-123 x 1 (Test Product)",
    subtotal: "$ 1000",
    total: "$ 1210",
    discount: "42"
};

// We need to follow redirects because Google Scripts redirect
function postData(url, data) {
    const dataString = JSON.stringify(data);
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json', // GAS handles JSON in post body often better if we follow redirects
            'Content-Length': dataString.length
        }
    };

    console.log("Sending data to:", url);

    const req = https.request(url, options, (res) => {
        console.log(`STATUS: ${res.statusCode}`);
        console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

        if (res.statusCode === 302 || res.statusCode === 307) {
            console.log("Redirecting to:", res.headers.location);
            postData(res.headers.location, data); // Recursive call for redirect
            return;
        }

        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            console.log(`BODY: ${chunk}`);
        });
        res.on('end', () => {
            console.log('No more data in response.');
        });
    });

    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });

    req.write(dataString);
    req.end();
}

postData(GOOGLE_SCRIPT_URL, orderData);
