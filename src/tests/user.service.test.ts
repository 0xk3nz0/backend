import { describe, beforeAll, afterAll, expect, it } from 'vitest';
import { type FastifyInstance } from "fastify";

import { PrismaClient } from "../generated/prisma/index.js";
import UserService from "../services/user.js";



const prisma = new PrismaClient({ log: [] });
let userService: UserService;

describe('UserService', () => {
  beforeAll(() => {
    const fastify: FastifyInstance = { log: console } as any; // mock minimal FastifyInstance
    userService = new UserService(fastify);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create a user', async () => {
    const result = await userService.create({
      email: 'test@example.com',
      name: 'Test User',
      password: '123456', // if your model requires it
    } as any);
    expect(result).toBeDefined();
  });

  it('should fetch the created user', async () => {
    const user = await userService.fetchBy({ email: 'test@example.com' });
    expect(user).not.toBeNull();
    expect(user?.email).toBe('test@example.com');
  });

  it('should update the user', async () => {
    const result = await userService.updateBy(
      { email: 'test@example.com' },
      { name: 'Updated Name' } as any
    );
    expect(result).toBe(true);
  });

  it('should delete the user', async () => {
    const result = await userService.deleteBy({ email: 'test@example.com' });
    expect(result).toBe(true);
  });
});
