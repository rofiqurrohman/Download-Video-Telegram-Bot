import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  isBlocked: boolean;
  blockedAt?: Date;
  blockedReason?: string;
  downloadCount: number;
  totalBytesDownloaded: number;
  createdAt: Date;
  lastActiveAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    telegramId: { type: Number, required: true, unique: true, index: true },
    username: { type: String },
    firstName: { type: String, required: true },
    lastName: { type: String },
    isBlocked: { type: Boolean, default: false, index: true },
    blockedAt: { type: Date },
    blockedReason: { type: String },
    downloadCount: { type: Number, default: 0 },
    totalBytesDownloaded: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);
