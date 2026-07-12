import cloudinary from "../../configs/cloudinary.js";
import { Readable } from "stream";

const uploadToCloudinary = (fileBuffer, folderName = "avatars") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: folderName },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );
    Readable.from(fileBuffer).pipe(uploadStream);
  });
};

export default uploadToCloudinary;
