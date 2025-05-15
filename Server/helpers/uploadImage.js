import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET
});

export const uploadImageToCloudinary = async (filePath) => {
    try {
        // Use file path for upload
        const result = await cloudinary.uploader.upload(filePath, {
            folder: 'GestureSmart',
            allowed_formats: ['jpeg', 'png', 'jpg'],
            use_filename: false,
            unique_filename: true
        });

        return result.secure_url;
    } catch (error) {
        console.error('Error uploading image:', error);
        throw new Error('Failed to upload image');
    }
};
