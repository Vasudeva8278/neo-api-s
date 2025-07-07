const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');
const path = require('path');
const cors= require('cors');
const app = express();
const upload = multer({ dest: 'uploads/' }); // Files will be stored in the 'uploads' folder 
app.use(cors());
app.use(express.static(path.join(__dirname, 'public'))); 

// Just for a basic check
app.get('/', (req, res) => {
    res.send('Hello from Express!');
});
/*
app.post('/convert', upload.single('docxFile'), (req, res) => {
    const filePath = req.file.path;
	
	console.log(filePath)

    mammoth.extractRawText({ path: filePath })
        .then(function (result) {
            const text = result.value;
            res.send(text); // Send the extracted text as response
        })
        .catch(error => {
            console.error(error);
            res.status(500).send('An error occurred during conversion.');
        });
});
app.listen(7000, () => {
    console.log('Server listening on port 7000');
});
*/