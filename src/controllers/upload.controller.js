import Profile from "../models/Profile.js";
import User from "../models/User.js";
import cloudinary from "../configs/cloudinary.js";
import uploadToCloudinary from "../lib/cloudinary/uploadToCloudinary.js";
import { MESSAGE } from "../constants/message.js";
import { toResultError, toResultOk } from "../results/Result.js";
import { Readable } from "stream";

const CV_ALLOWED_MIME_TYPES = ["application/pdf"];
const CV_MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const CV_CLOUD_FOLDER = "cv";
const AVATAR_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const AVATAR_CLOUD_FOLDER = "avatar";

const parseCvField = (value) => {
	if (!value) return null;

	if (typeof value === "object" && value.url) {
		return value;
	}

	if (typeof value === "string") {
		try {
			const parsed = JSON.parse(value);
			if (parsed && typeof parsed === "object") {
				return parsed;
			}
		} catch (err) {
			return { url: value };
		}
	}

	return null;
};


const parseAvatarField = (value) => {
	if (!value) return null;

	if (typeof value === "object" && value.url) {
		return value;
	}

	if (typeof value === "string") {
		try {
			const parsed = JSON.parse(value);
			if (parsed && typeof parsed === "object") {
				return parsed;
			}
		} catch (err) {
			return { url: value };
		}
	}

	return null;
};

const formatCvResponse = (cvData) => {
	if (!cvData) return null;
	return {
		url: cvData.url || "",
		fileName: cvData.fileName || "",
		fileSize: cvData.fileSize ?? null,
		mimeType: cvData.mimeType || "",
		uploadedAt: cvData.uploadedAt || null,
	};
};

const formatAvatarResponse = (avatarData) => {
	if (!avatarData) return null;
	const response = { url: avatarData.url || "" };
	if (avatarData.fileName) {
		response.fileName = avatarData.fileName;
	}
	if (typeof avatarData.fileSize === "number") {
		response.fileSize = avatarData.fileSize;
	}
	if (avatarData.mimeType) {
		response.mimeType = avatarData.mimeType;
	}
	if (avatarData.uploadedAt) {
		response.uploadedAt = avatarData.uploadedAt;
	}
	return response;
};

const validateCvFile = (file) => {
	if (!file) {
		return toResultError({ statusCode: 400, msg: MESSAGE.CV_FILE_REQUIRED });
	}

	if (!CV_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
		return toResultError({ statusCode: 400, msg: MESSAGE.CV_FILETYPE_INVALID });
	}

	if (file.size > CV_MAX_SIZE_BYTES) {
		return toResultError({
			statusCode: 400,
			msg: MESSAGE.CV_FILESIZE_EXCEEDED,
		});
	}

	return null;
};

const validateAvatarFile = (file) => {
	if (!file) {
		return toResultError({ statusCode: 400, msg: MESSAGE.AVATAR_FILE_REQUIRED });
	}

	if (!AVATAR_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
		return toResultError({
			statusCode: 400,
			msg: MESSAGE.AVATAR_FILETYPE_INVALID,
		});
	}

	if (file.size > AVATAR_MAX_SIZE_BYTES) {
		return toResultError({
			statusCode: 400,
			msg: MESSAGE.AVATAR_FILESIZE_EXCEEDED,
		});
	}

	return null;
};
// tạo payload metadata để lưu trữ
const buildCvPayload = (file, uploadResult) => ({
	url: uploadResult.url,
	publicId: uploadResult.public_id,
	fileName: file.originalname,
	fileSize: file.size,
	mimeType: file.mimetype,
	uploadedAt: new Date().toISOString(),
});

const uploadCandidateCvFile = async (file) => {
	if (file.mimetype === "application/pdf") {
		return new Promise((resolve, reject) => {
			const uploadStream = cloudinary.uploader.upload_stream(
				{ folder: CV_CLOUD_FOLDER, resource_type: "raw" },
				(error, result) => {
					if (error) return reject(error);
					resolve({ url: result.secure_url, public_id: result.public_id });
				}
			);
			Readable.from(file.buffer).pipe(uploadStream);
		});
	}

	return uploadToCloudinary(file.buffer, CV_CLOUD_FOLDER);
};
// lưu CV vào profile
const persistCv = async (userId, profile, payload) => {
	const serialized = JSON.stringify(payload);

	if (profile) {
		profile.cv = serialized;
		await profile.save();
		return profile;
	}

	const created = await Profile.create({ user: userId, cv: serialized });
	return created;
};

const buildAvatarPayload = (file, uploadResult) => ({
	url: uploadResult.url,
	publicId: uploadResult.public_id,
	fileName: file.originalname,
	fileSize: file.size,
	mimeType: file.mimetype,
	uploadedAt: new Date().toISOString(),
});

const persistAvatar = async (user, payload) => {
	user.avatar = JSON.stringify(payload);
	await user.save();
	return user;
};
// xóa tài nguyên trên cloudinary
const cleanupCloudinaryAsset = async (publicId, mimeType) => {
	if (!publicId) return;

	const resourceTypes = mimeType === "application/pdf" ? ["raw", "image"] : ["image", "raw"];

	let lastError = null;

	for (const resourceType of resourceTypes) {
		try {
			const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
			if (result?.result === "ok" || result?.result === "not found") {
				return;
			}
		} catch (error) {
			lastError = error;
		}
	}

	if (lastError) {
		console.error(" Failed to destroy Cloudinary asset", {
			publicId,
			mimeType,
			error: lastError,
		});
	}
};

export const updateUserAvatar = async (req, res) => {
	try {
		const { userId } = req.params;
		const authUser = req.user;
		if (!authUser) {
			const errorResult = toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED });
			return res.status(errorResult.statusCode).json(errorResult);
		}

		const fileValidationError = validateAvatarFile(req.file);
		if (fileValidationError) {
			return res.status(fileValidationError.statusCode).json(fileValidationError);
		}

		// Sử dụng authUser thay vì loadUserContext
		const existingAvatar = parseAvatarField(authUser.avatar);
		if (!existingAvatar || !existingAvatar.url) {
			return res
				.status(404)
				.json(
					toResultError({ statusCode: 404, msg: MESSAGE.AVATAR_NOT_FOUND })
				);
		}

		const uploadResult = await uploadToCloudinary(req.file.buffer, AVATAR_CLOUD_FOLDER);
		const payload = buildAvatarPayload(req.file, uploadResult);
		await persistAvatar(authUser, payload);
		await cleanupCloudinaryImage(resolveAvatarPublicId(existingAvatar));
		return res.json(
			toResultOk({
				msg: MESSAGE.AVATAR_UPDATE_SUCCESS,
				data: formatAvatarResponse(payload),
			})
		);
	} catch (error) {
		return res
			.status(500)
			.json(
				toResultError({ statusCode: 500, msg: MESSAGE.AVATAR_UPDATE_FAILED })
			);
	}
};

export const deleteUserAvatar = async (req, res) => {
	try {
		const { userId } = req.params;
		const authUser = req.user;
		if (!authUser) {
			const errorResult = toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED });
			return res.status(errorResult.statusCode).json(errorResult);
		}

		// Sử dụng authUser thay vì loadUserContext
		const existingAvatar = parseAvatarField(authUser.avatar);
		if (!existingAvatar || !existingAvatar.url) {
			return res
				.status(404)
				.json(
					toResultError({ statusCode: 404, msg: MESSAGE.AVATAR_NOT_FOUND })
				);
		}

		authUser.avatar = null;
		await authUser.save();

		await cleanupCloudinaryImage(resolveAvatarPublicId(existingAvatar));

		return res.json(toResultOk({ msg: MESSAGE.AVATAR_DELETE_SUCCESS }));
	} catch (error) {
		return res
			.status(500)
			.json(
				toResultError({ statusCode: 500, msg: MESSAGE.AVATAR_DELETE_FAILED })
			);
	}
};

const extractCloudinaryPublicIdFromUrl = (url) => {
	if (!url) return null;

	try {
		const parsedUrl = new URL(url);
		const segments = parsedUrl.pathname.split("/").filter(Boolean);
		const uploadIndex = segments.indexOf("upload");
		if (uploadIndex === -1) return null;
		const rest = segments.slice(uploadIndex + 1);
		if (!rest.length) return null;
		if (rest[0].startsWith("v") && rest[0].length > 1) {
			rest.shift();
		}
		if (!rest.length) return null;
		const lastSegment = rest[rest.length - 1];
		const dotIndex = lastSegment.lastIndexOf(".");
		if (dotIndex !== -1) {
			rest[rest.length - 1] = lastSegment.substring(0, dotIndex);
		}
		return rest.join("/");
	} catch (error) {
		return null;
	}
};

const resolveAvatarPublicId = (avatarData) => {
	if (!avatarData) return null;
	return (
		avatarData.publicId ||
		avatarData.public_id ||
		extractCloudinaryPublicIdFromUrl(avatarData.url)
	);
};

const cleanupCloudinaryImage = async (publicId) => {
	if (!publicId) return;

	try {
		await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
	} catch (error) {
		console.error(" Failed to destroy Cloudinary avatar", {
			publicId,
			error,
		});
	}
};

export const getCandidateCv = async (req, res) => {
	try {
		const { userId } = req.params;
		const authUser = req.user;
		if (!authUser) {
			const errorResult = toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED });
			return res.status(errorResult.statusCode).json(errorResult);
		}

		// Sử dụng authUser._id thay vì userId từ params để tránh lỗi 403
		const targetUserId = authUser._id;
		
		const profile = await Profile.findOne({ user: targetUserId });

		const cvData =
			profile && profile.cv
				? formatCvResponse(parseCvField(profile.cv))
				: null;

		return res.json(
			toResultOk({
				msg: MESSAGE.CV_FETCH_SUCCESS,
				data: cvData,
			})
		);
	} catch (error) {
		console.error("getCandidateCv error:", error);
		return res
			.status(500)
			.json(toResultError({ statusCode: 500, msg: MESSAGE.CV_FETCH_FAILED }));
	}
};


export const addCandidateCv = async (req, res) => {
	try {
		const { userId } = req.params;
		const authUser = req.user;
		
		if (!authUser) {
			const errorResult = toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED });
			return res.status(errorResult.statusCode).json(errorResult);
		}

		const profile = await Profile.findOne({ user: authUser._id });
		
		const fileValidationError = validateCvFile(req.file);
		if (fileValidationError) {
			return res.status(fileValidationError.statusCode).json(fileValidationError);
		}

		// Kiểm tra nếu đã có CV thì xóa CV cũ trước khi upload CV mới
		const existingCv = profile && profile.cv ? parseCvField(profile.cv) : null;
		if (existingCv && existingCv.url) {
			// Cleanup CV cũ trên Cloudinary
			await cleanupCloudinaryAsset(
				existingCv.publicId || existingCv.public_id,
				existingCv.mimeType
			);
		}

		const uploadResult = await uploadCandidateCvFile(req.file);
		const payload = buildCvPayload(req.file, uploadResult);

		await persistCv(authUser._id, profile, payload);

		const statusCode = existingCv ? 200 : 201;
		const message = existingCv ? MESSAGE.CV_UPDATE_SUCCESS : MESSAGE.CV_UPLOAD_SUCCESS;

		const responseData = formatCvResponse(payload);
		return res
			.status(statusCode)
			.json(
				toResultOk({
					statusCode: statusCode,
					msg: message,
					data: responseData,
				})
			);
	} catch (error) {
		console.error("addCandidateCv error:", error);
		return res
			.status(500)
			.json(toResultError({ statusCode: 500, msg: MESSAGE.CV_UPLOAD_FAILED }));
	}
};

export const updateCandidateCv = async (req, res) => {
	try {
		const { userId } = req.params;
		const authUser = req.user;
		if (!authUser) {
			const errorResult = toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED });
			return res.status(errorResult.statusCode).json(errorResult);
		}

		// Sử dụng authUser._id thay vì kiểm tra userId từ params
		const profile = await Profile.findOne({ user: authUser._id });
		const fileValidationError = validateCvFile(req.file);
		if (fileValidationError) {
			return res.status(fileValidationError.statusCode).json(fileValidationError);
		}

		if (!profile || !profile.cv) {
			return res
				.status(404)
				.json(toResultError({ statusCode: 404, msg: MESSAGE.CV_NOT_FOUND }));
		}

		const existingCv = parseCvField(profile.cv);

		const uploadResult = await uploadCandidateCvFile(req.file);
		const payload = buildCvPayload(req.file, uploadResult);

		await persistCv(authUser._id, profile, payload);

		await cleanupCloudinaryAsset(
			existingCv?.publicId || existingCv?.public_id,
			existingCv?.mimeType
		);

		const responseData = formatCvResponse(payload);
		return res.json(
			toResultOk({
				msg: MESSAGE.CV_UPDATE_SUCCESS,
				data: responseData,
			})
		);
	} catch (error) {
		return res
			.status(500)
			.json(toResultError({ statusCode: 500, msg: MESSAGE.CV_UPDATE_FAILED }));
	}
};

export const deleteCandidateCv = async (req, res) => {
	try {
		const { userId } = req.params;
		const authUser = req.user;
		if (!authUser) {
			const errorResult = toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED });
			return res.status(errorResult.statusCode).json(errorResult);
		}

		// Sử dụng authUser._id thay vì kiểm tra userId từ params
		const profile = await Profile.findOne({ user: authUser._id });
		if (!profile || !profile.cv) {
			return res
				.status(404)
				.json(toResultError({ statusCode: 404, msg: MESSAGE.CV_NOT_FOUND }));
		}

		const existingCv = parseCvField(profile.cv);
		profile.cv = null;
		await profile.save();

		await cleanupCloudinaryAsset(
			existingCv?.publicId || existingCv?.public_id,
			existingCv?.mimeType
		);

		return res.json(toResultOk({ msg: MESSAGE.CV_DELETE_SUCCESS }));
	} catch (error) {
		return res
			.status(500)
			.json(toResultError({ statusCode: 500, msg: MESSAGE.CV_DELETE_FAILED }));
	}
};


export const getUserAvatar = async (req, res) => {
	try {
		const { userId } = req.params;
		const authUser = req.user;
		if (!authUser) {
			const errorResult = toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED });
			return res.status(errorResult.statusCode).json(errorResult);
		}

		// Sử dụng authUser thay vì userId từ params để tránh lỗi 404
		const avatarData = formatAvatarResponse(parseAvatarField(authUser.avatar));

		return res.json(
			toResultOk({
				msg: MESSAGE.AVATAR_FETCH_SUCCESS,
				data: avatarData && avatarData.url ? avatarData : null,
			})
		);
	} catch (error) {
		console.error("getUserAvatar error:", error);
		return res
			.status(500)
			.json(
				toResultError({ statusCode: 500, msg: MESSAGE.AVATAR_FETCH_FAILED })
			);
	}
};

export const addUserAvatar = async (req, res) => {
	try {
		const { userId } = req.params;
		const authUser = req.user;
		
		if (!authUser) {
			const errorResult = toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED });
			return res.status(errorResult.statusCode).json(errorResult);
		}

		const fileValidationError = validateAvatarFile(req.file);
		if (fileValidationError) {
			return res.status(fileValidationError.statusCode).json(fileValidationError);
		}

		// Kiểm tra nếu đã có avatar thì xóa avatar cũ trước khi upload avatar mới
		const existingAvatar = parseAvatarField(authUser.avatar);
		if (existingAvatar && existingAvatar.url) {
			// Cleanup avatar cũ trên Cloudinary
			await cleanupCloudinaryImage(resolveAvatarPublicId(existingAvatar));
		}

		const uploadResult = await uploadToCloudinary(req.file.buffer, AVATAR_CLOUD_FOLDER);
		const payload = buildAvatarPayload(req.file, uploadResult);

		await persistAvatar(authUser, payload);

		const statusCode = existingAvatar ? 200 : 201;
		const message = existingAvatar ? MESSAGE.AVATAR_UPDATE_SUCCESS : MESSAGE.AVATAR_UPLOAD_SUCCESS;

		return res
			.status(statusCode)
			.json(
				toResultOk({
					statusCode: statusCode,
					msg: message,
					data: formatAvatarResponse(payload),
				})
			);
	} catch (error) {
		console.error("addUserAvatar error:", error);
		return res
			.status(500)
			.json(
				toResultError({ statusCode: 500, msg: MESSAGE.AVATAR_UPLOAD_FAILED })
			);
	}
};