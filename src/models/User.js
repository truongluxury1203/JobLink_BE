import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      maxlength: 108,
      trim: true,
      lowercase: true,
      default: "",
    },
    username: {
      type: String,
      maxlength: 30,
      trim: true,
      default: "",
    },
    password: {
      type: String,
      default: "",
    },
    firstName: {
      type: String,
      required: true,
      maxlength: 30,
      trim: true,
      default: "",
    },
    lastName: {
      type: String,
      required: true,
      maxlength: 30,
      trim: true,
      default: "",
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    phoneNumber: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    avatar: { type: String, default: "" },
    isEmailVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Hash password trước khi lưu
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// So sánh mật khẩu
UserSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model("User", UserSchema);
