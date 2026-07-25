import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import jwt from "jsonwebtoken";
import type { UserRecord } from "./seed.js";
import { StateService } from "./state.service.js";

const secret = process.env.JWT_SECRET || "hannao-local-development-secret-change-me";

export function signSession(user: UserRecord) {
  return jwt.sign({ sub: user.id, phone: user.phone }, secret, { expiresIn: "8h", issuer: "hannao-assets" });
}

export function safeUser(user: UserRecord) {
  const { passwordHash: _passwordHash, ...result } = user;
  return result;
}

export function sessionUser(token: string, state: StateService) {
  if (!token) return undefined;
  try {
    const payload = jwt.verify(token, secret, { issuer: "hannao-assets" }) as jwt.JwtPayload;
    const user = state.userById(String(payload.sub));
    return user?.status === "active" ? user : undefined;
  } catch {
    return undefined;
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly state: StateService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException("请先登录");
    try {
      const user = sessionUser(token, this.state);
      if (!user || user.status !== "active") throw new UnauthorizedException("账号已停用");
      request.user = user;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("登录状态已失效");
    }
  }
}
