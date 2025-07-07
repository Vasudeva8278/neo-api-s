const path = require('path');
const fs = require('fs');
const multer = require('multer');


   
let highlightId='';
// Set storage engine
const storage = multer.diskStorage({
  destination: './src/uploads',
  filename: (req, file, cb) => {
     const highlightId=req.query.highlightId;
      const documentId = req.query.documentId;
      const newImageName= documentId? `${documentId}-${highlightId}` : highlightId;
       
     //.jpeg or .jpg save it as .jpeg
    //  let extension;
    //  if(path.extname(file.originalname) === '.jpeg' || path.extname(file.originalname) === '.jpg')
    //    extension = '.jpeg'
    //  else extension = path.extname(file.originalname);

      // Check and delete if the file already exists
    //  const filePath = path.join(__dirname, 'uploads', newImageName+file.originalname + extension);
    /*
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath); // Delete the existing file
          console.log(`Deleted existing file: ${filePath}`);
        } catch (err) {
          console.error(`Error deleting file: ${filePath}`, err);
        }
      }*/

    cb(null, newImageName + file.originalname);
  }
});

// Initialize upload
const upload = multer({ storage: storage,
   fileFilter: (req, file, cb) => { checkFileType(file, cb); } 
}).single('image');


// Check file type
function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Images Only!');
  }
 }
  exports.test =(req,res) => {
    //console.log(req);
  }
   
  // to uplaod an image into Images folder for an template
  exports.uploadImage = (req, res) => {
    
  upload(req, res, (err) => {
    
      const highlightId=req.query.highlightId;
      const documentId = req.query.documentId;
      const newImageName= documentId? `${documentId}-${highlightId}` : highlightId;
      //let extension;
      //if(path.extname(req.file.originalname) === '.jpeg' || path.extname(req.file.originalname) === '.jpg')
      //  extension = '.jpeg'
      //  else extension = path.extname(req.file.originalname);
      
      
      if (err) {
        res.status(400).json({ error: err });
      } else {
        if (req.file === undefined) {
          res.status(400).json({ error: 'No file selected!' });
        } else {
            res.status(200).json({
            message: 'File uploaded successfully!',
            data: `${newImageName +req.file.originalname}`
          });
        }
      }
    });
  };
  
  exports.getImage = (req, res) => {
   // console.log("in getImage")
    const imageName = req.params.imageName;
    const uploadsPath = path.join(__dirname, '../uploads');
    const imagePath = path.join(uploadsPath, imageName);
   // console.log(uploadsPath);
   // console.log(imagePath);
    res.sendFile(imagePath, (err) => {
        if (err) {
            res.status(404).send('Image not found');
        }
    });
};