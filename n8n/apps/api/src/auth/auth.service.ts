import { Injectable, ConflictException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { LoginInput, RegisterInput } from "@n8n-clone/shared-types";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  async register(input: RegisterInput) {
    const { email, password, name } = input;

    // Check if user exists
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException("Email is already registered.");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user, a default Workspace, and OWNER membership in a single transaction!
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
        },
      });

      const defaultWorkspace = await tx.workspace.create({
        data: {
          name: `${name || "User"}'s Workspace`,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: defaultWorkspace.id,
          userId: newUser.id,
          role: "OWNER",
        },
      });

      return newUser;
    });

    // Generate token
    const token = this.generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    };
  }

  async login(input: LoginInput) {
    const { email, password } = input;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const token = this.generateToken(user.id, user.email);

    // Get default workspace
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      include: { workspace: true },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      workspaceId: membership?.workspaceId,
      token,
    };
  }

  private generateToken(userId: string, email: string): string {
    return this.jwtService.sign({ sub: userId, email });
  }
}
