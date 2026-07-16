import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth";
import articleRoutes from "./routes/articles";
import categoryRoutes from "./routes/categories";
import commentRoutes from "./routes/comments";
import userRoutes from "./routes/users";
import notificationRoutes from "./routes/notifications";
import mediaRoutes from "./routes/media";
import adminRoutes from "./routes/admin";
import searchRoutes from "./routes/search";
import { authLimiter } from "./middleware/rateLimit";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") ?? "*" }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const v1 = express.Router();
v1.use("/auth", authLimiter, authRoutes);
v1.use("/articles", articleRoutes);
v1.use("/categories", categoryRoutes);
v1.use("/comments", commentRoutes);
v1.use("/users", userRoutes);
v1.use("/notifications", notificationRoutes);
v1.use("/media", mediaRoutes);
v1.use("/admin", adminRoutes);
v1.use("/search", searchRoutes);

app.use("/api/v1", v1);

// Central error handler — keeps bilingual error shape consistent
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status ?? 500).json({
    error: { code: err.code ?? "INTERNAL_ERROR", message: err.message ?? "Something went wrong", messageMy: "တစ်ခုခုမှားယွင်းသွားသည်" },
  });
});

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => console.log(`Citizen News API listening on :${PORT}`));
