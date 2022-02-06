const fs = require('fs');
 

// deletes the link and file related to that link
const deleteFile = (filePath) => {
    fs.unlink(filePath, (err) => {
        if(err) {
            throw(err)
        }
    })       
}

exports.deleteFile = deleteFile;