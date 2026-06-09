import { Controller, Post, Body, Get, UseGuards, Req } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthGuard } from "@nestjs/passport";
import { LoginInput, RegisterInput } from "@n8n-clone/shared-types";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("register")
  async register(@Body() body: RegisterInput) {
    return this.authService.register(body);
  }

  @Post("login")
  async login(@Body() body: LoginInput) {
    return this.authService.login(body);
  }

  @Get("me")
  @UseGuards(AuthGuard("jwt"))
  async getProfile(@Req() req: any) {
    return req.user;
  }
}
