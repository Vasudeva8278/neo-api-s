const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

// Function to zip a folder
const zipFolder = (source, out) => {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const stream = fs.createWriteStream(out);

  return new Promise((resolve, reject) => {
    archive
      .directory(source, false)
      .on('error', err => reject(err))
      .pipe(stream);

    stream.on('close', () => resolve());
    archive.finalize();
  });
};

// Controller function to handle the zip request
const zipFolderController = async (req, res) => {
  const folderPath = req.query.folderPath;
  const outputPath = path.join(__dirname, '../output.zip');

  if (!folderPath) {
    return res.status(400).send('Folder path is required');
  }

  try {
    await zipFolder(folderPath, outputPath);
    res.download(outputPath, 'output.zip', err => {
      if (err) {
        console.error(err);
        res.status(500).send('Failed to download the zip file');
      } else {
        // Remove the zip file after sending it to the client
        fs.unlinkSync(outputPath);
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to zip the folder');
  }
};

module.exports = {
  zipFolderController,
};
