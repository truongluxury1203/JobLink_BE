import UpgradeRequest from "../models/UpgradeRequest.js";
import User from "../models/User.js";
import Role from "../models/Role.js";
import Company from "../models/Company.js";
import validator from "validator";
import { MESSAGE } from "../constants/message.js";
import { NOTIFICATION_CATEGORY, NOTIFICATION_PRIORITY } from "../constants/notification.js";
import { notifyRole, notifyUser } from "../services/notification.service.js";

// User tạo upgrade request
export const createUpgradeRequest = async (req, res) => {
  try {
    const { user } = req;

    // Debug: Log req.body để xem dữ liệu nhận được
    console.log("req.body:", req.body);
    console.log("req.file:", req.file);

    // Parse companyInfo từ form-data - cách đơn giản hơn
    const companyInfo = {
      name: req.body["companyInfo[name]"] || req.body.companyName,
      description: req.body["companyInfo[description]"] || req.body.companyDescription,
      logo: req.body["companyInfo[logo]"] || req.body.companyLogo,
      banner: req.body["companyInfo[banner]"] || req.body.companyBanner,
      benefits: req.body["companyInfo[benefits]"] || req.body.companyBenefits,
      vision: req.body["companyInfo[vision]"] || req.body.companyVision,
      industry: req.body["companyInfo[industry]"] || req.body.companyIndustry,
      address: req.body["companyInfo[address]"] || req.body.companyAddress,
      contact: {
        email: req.body["companyInfo[contact][email]"] || req.body.companyEmail,
        phone: req.body["companyInfo[contact][phone]"] || req.body.companyPhone,
        website: req.body["companyInfo[contact][website]"] || req.body.companyWebsite,
      },
    };

    // Debug: Log companyInfo để kiểm tra
    console.log("Parsed companyInfo:", companyInfo);

    // Kiểm tra required fields
    if (!companyInfo.name) {
      return res.status(400).json({
        success: false,
        message: "Company name is required",
      });
    }

    // Validate phone number (must be 10 digits)
    if (companyInfo.contact && companyInfo.contact.phone) {
      const phoneToValidate = companyInfo.contact.phone;
      const cleanPhone = phoneToValidate.replace(/\s+/g, "").replace(/[^\d]/g, "");
      if (cleanPhone.length !== 10 || !/^[0-9]+$/.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          message: MESSAGE.COMPANY_PHONE_INVALID,
        });
      }
      // Save clean phone
      companyInfo.contact.phone = cleanPhone;
    }

    // Validate email format
    if (companyInfo.contact && companyInfo.contact.email) {
      if (!validator.isEmail(companyInfo.contact.email)) {
        return res.status(400).json({
          success: false,
          message: MESSAGE.COMPANY_EMAIL_INVALID,
        });
      }
    }

    // Kiểm tra file business license
    const businessLicenseFile = req.file;
    if (!businessLicenseFile) {
      return res.status(400).json({
        success: false,
        message: "Business license file is required",
      });
    }

    // Kiểm tra user đã có upgrade request pending chưa
    const existingRequest = await UpgradeRequest.findOne({
      user: user._id,
      status: "pending",
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending upgrade request",
      });
    }

    // Chuyển file buffer thành base64 để lưu vào MongoDB
    const businessLicenseBase64 = businessLicenseFile.buffer.toString("base64");

    // Tạo upgrade request
    const upgradeRequest = new UpgradeRequest({
      user: user._id,
      companyInfo,
      businessLicense: businessLicenseBase64,
      status: "pending",
    });

    await upgradeRequest.save();

    const ownerName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;

    await Promise.allSettled([
      notifyUser({
        userId: user._id,
        senderId: null,
        title: "Yêu cầu nâng cấp đã được gửi",
        message:
          "Chúng tôi đã nhận được yêu cầu nâng cấp tài khoản của bạn. Bộ phận quản trị sẽ phản hồi trong thời gian sớm nhất.",
        category: NOTIFICATION_CATEGORY.ACCOUNT,
        priority: NOTIFICATION_PRIORITY.INFO,
        metadata: {
          requestId: upgradeRequest._id.toString(),
        },
        action: {
          label: "Xem trạng thái",
          url: "/candidate/request-upgrade",
        },
      }),
      notifyRole({
        role: "admin",
        senderId: user._id,
        title: "Yêu cầu nâng cấp mới",
        message: `${ownerName} vừa gửi yêu cầu nâng cấp tài khoản lên nhà tuyển dụng.`,
        category: NOTIFICATION_CATEGORY.ACCOUNT,
        priority: NOTIFICATION_PRIORITY.WARNING,
        metadata: {
          requestId: upgradeRequest._id.toString(),
          userId: user._id.toString(),
        },
        action: {
          label: "Duyệt yêu cầu",
          url: "/admin/upgrade-requests",
        },
      }),
    ]);

    // Populate user info
    await upgradeRequest.populate("user", "firstName lastName email");

    res.status(201).json({
      success: true,
      message: "Upgrade request submitted successfully",
      data: upgradeRequest,
    });
  } catch (error) {
    console.error("Error creating upgrade request:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// User xem upgrade request của mình
export const getMyUpgradeRequest = async (req, res) => {
  try {
    const { user } = req;

    const upgradeRequest = await UpgradeRequest.findOne({ user: user._id })
      .populate("user", "firstName lastName email")
      .populate("reviewedBy", "firstName lastName")
      .sort({ createdAt: -1 });

    if (!upgradeRequest) {
      return res.status(200).json({
        success: true,
        message: "No upgrade request found",
        data: null,
      });
    }

    res.status(200).json({
      success: true,
      message: "Upgrade request retrieved successfully",
      data: upgradeRequest,
    });
  } catch (error) {
    console.error("Error getting upgrade request:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Admin: Lấy tất cả upgrade requests với pagination
export const getAllUpgradeRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const filter = status ? { status } : {};

    // Parse page and limit to numbers
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const total = await UpgradeRequest.countDocuments(filter);

    // Fetch requests with pagination
    const requests = await UpgradeRequest.find(filter)
      .select("-businessLicense")
      .populate("user", "firstName lastName email")
      .populate("reviewedBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      message: "Upgrade requests retrieved successfully",
      data: requests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error getting upgrade requests:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Admin: Xem chi tiết upgrade request
export const getUpgradeRequestById = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await UpgradeRequest.findById(requestId)
      .populate("user", "firstName lastName email")
      .populate("reviewedBy", "firstName lastName");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Upgrade request not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Upgrade request retrieved successfully",
      data: request,
    });
  } catch (error) {
    console.error("Error getting upgrade request:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Admin: Duyệt/từ chối upgrade request
export const reviewUpgradeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, adminNote } = req.body;
    const adminId = req.user._id;

    // Validate status
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'approved' or 'rejected'",
      });
    }

    // Tìm upgrade request
    const request = await UpgradeRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Upgrade request not found",
      });
    }

    // Kiểm tra request đã được review chưa
    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "This request has already been reviewed",
      });
    }

    // Cập nhật request
    request.status = status;
    request.adminNote = adminNote;
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
    await request.save();

    // Nếu approve, cập nhật role user thành recruiter và tạo company
    if (status === "approved") {
      try {
        console.log("Starting approval process for user:", request.user);

        const recruiterRole = await Role.findOne({ name: "recruiter" });
        if (!recruiterRole) {
          console.error("Recruiter role not found in database");
          return res.status(500).json({
            success: false,
            message: "Recruiter role not found in database",
          });
        }

        console.log("Found recruiter role:", recruiterRole._id);

        // Cập nhật role user thành recruiter
        const updatedUser = await User.findByIdAndUpdate(
          request.user,
          {
            role: recruiterRole._id,
          },
          { new: true }
        );

        if (!updatedUser) {
          console.error("User not found:", request.user);
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        console.log("Updated user role:", updatedUser._id);

        // Tạo company record từ thông tin trong upgrade request
        const companyData = {
          recruiter: request.user,
          name: request.companyInfo.name,
          logo: request.companyInfo.logo || "",
          banner: request.companyInfo.banner || "",
          description: request.companyInfo.description || "",
          benefits: request.companyInfo.benefits || "",
          vision: request.companyInfo.vision || "",
          contact: {
            email: request.companyInfo.contact?.email || "",
            phone: request.companyInfo.contact?.phone || "",
            website: request.companyInfo.contact?.website || "",
          },
          address: request.companyInfo.address || "",
          industry: request.companyInfo.industry || "",
        };

        console.log("Company data to save:", companyData);

        // Kiểm tra xem user đã có company chưa
        console.log("Checking for existing company with recruiter:", request.user);
        const existingCompany = await Company.findOne({ recruiter: request.user });
        console.log("Existing company found:", existingCompany ? existingCompany._id : "None");

        if (!existingCompany) {
          // Tạo company mới
          console.log("Creating new company...");
          const newCompany = new Company(companyData);
          const savedCompany = await newCompany.save();
          console.log(`✅ Created new company for user ${request.user}:`, savedCompany._id);
          console.log("New company details:", {
            id: savedCompany._id,
            name: savedCompany.name,
            recruiter: savedCompany.recruiter,
          });
        } else {
          // Cập nhật company hiện có
          console.log("Updating existing company...");
          const updatedCompany = await Company.findByIdAndUpdate(existingCompany._id, companyData, {
            new: true,
          });
          console.log(`✅ Updated existing company for user ${request.user}:`, updatedCompany._id);
          console.log("Updated company details:", {
            id: updatedCompany._id,
            name: updatedCompany.name,
            recruiter: updatedCompany.recruiter,
          });
        }

        console.log("Approval process completed successfully");

        // Verify company was created/updated
        const verifyCompany = await Company.findOne({ recruiter: request.user });
        console.log(
          "🔍 Verification - Company after approval:",
          verifyCompany
            ? {
                id: verifyCompany._id,
                name: verifyCompany.name,
                recruiter: verifyCompany.recruiter,
              }
            : "❌ No company found!"
        );
      } catch (approvalError) {
        console.error("❌ Error during approval process:", approvalError);
        console.error("Error details:", {
          message: approvalError.message,
          stack: approvalError.stack,
        });
        // Không return error ở đây vì request đã được cập nhật thành công
        // Chỉ log error để debug
      }
    }

    // Populate để trả về đầy đủ thông tin
    await request.populate("user", "firstName lastName email");
    await request.populate("reviewedBy", "firstName lastName");

    const owner = request.user;
    const ownerId = owner?._id?.toString?.() || owner?.toString?.();
    const reviewerName = `${req.user?.firstName || ""} ${req.user?.lastName || ""}`.trim();
    const reviewerLabel = reviewerName || req.user?.email || "Quản trị viên";

    if (ownerId) {
      const metadata = {
        requestId: request._id.toString(),
        status,
        reviewedBy: adminId.toString(),
      };

      if (request.reviewedAt) {
        metadata.reviewedAt = request.reviewedAt.toISOString();
      }

      if (adminNote) {
        metadata.adminNote = adminNote;
      }

      let action = {
        label: "Xem yêu cầu",
        url: "/candidate/request-upgrade",
      };

      if (status === "approved") {
        metadata.newRole = "recruiter";
        metadata.shouldRefreshUser = true;
        action = {
          label: "Quản lý tuyển dụng",
          url: "/recruiter/overview",
        };
      } else {
        metadata.shouldRefreshUser = false;
      }

      metadata.redirectTo = action.url;

      const notificationPayload =
        status === "approved"
          ? {
              title: "Yêu cầu nâng cấp được duyệt",
              message: `${reviewerLabel} đã duyệt yêu cầu nâng cấp tài khoản của bạn. Tài khoản sẽ được chuyển sang chế độ nhà tuyển dụng ngay lập tức.`,
              priority: NOTIFICATION_PRIORITY.SUCCESS,
            }
          : {
              title: "Yêu cầu nâng cấp bị từ chối",
              message: `${reviewerLabel} đã từ chối yêu cầu nâng cấp tài khoản của bạn.${adminNote ? ` Lý do: ${adminNote}` : ""}`,
              priority: NOTIFICATION_PRIORITY.WARNING,
            };

      try {
        await notifyUser({
          userId: ownerId,
          senderId: adminId,
          category: NOTIFICATION_CATEGORY.ACCOUNT,
          metadata,
          action,
          ...notificationPayload,
        });
      } catch (notificationError) {
        console.error("Error sending upgrade request notification:", notificationError);
      }
    }

    res.status(200).json({
      success: true,
      message:
        status === "approved"
          ? `Upgrade request approved successfully. User role updated to recruiter and company profile created.`
          : `Upgrade request ${status} successfully`,
      data: request,
    });
  } catch (error) {
    console.error("Error reviewing upgrade request:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Admin: Thống kê upgrade requests
export const getUpgradeRequestStats = async (req, res) => {
  try {
    const stats = await UpgradeRequest.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalRequests = await UpgradeRequest.countDocuments();
    const pendingRequests = await UpgradeRequest.countDocuments({ status: "pending" });

    res.status(200).json({
      success: true,
      message: "Upgrade request statistics retrieved successfully",
      data: {
        total: totalRequests,
        pending: pendingRequests,
        breakdown: stats,
      },
    });
  } catch (error) {
    console.error("Error getting upgrade request stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
