import { api, authHeader } from "./request.ts";

export interface TestUser {
  email: string;
  password: string;
  token: string;
  id: number;
}

const ADMIN = {
  name: "Test Admin",
  email: "admin@test.example.com",
  password: "AdminPass123!",
};

const LEARNER = {
  email: "learner@test.example.com",
  password: "LearnerPass123!",
  firstName: "Test",
};

export async function setupAdmin(): Promise<TestUser> {
  const res = await api()
    .post("/api/auth/setup-admin")
    .send({
      name: ADMIN.name,
      email: ADMIN.email,
      password: ADMIN.password,
    })
    .expect(201);

  expect(res.body).toHaveProperty("token");
  return {
    email: ADMIN.email,
    password: ADMIN.password,
    token: res.body.token,
    id: res.body.user.id,
  };
}

export async function loginAs(email: string, password: string): Promise<string> {
  const res = await api().post("/api/auth/login").send({ email, password }).expect(200);
  return res.body.token;
}

export async function createLearner(adminToken: string): Promise<TestUser> {
  const res = await api()
    .post("/api/users")
    .set(authHeader(adminToken))
    .send({
      email: LEARNER.email,
      password: LEARNER.password,
      firstName: LEARNER.firstName,
      role: "user",
    })
    .expect(201);

  const initialToken = await loginAs(LEARNER.email, LEARNER.password);
  const newPassword = `${LEARNER.password}X`;
  await changePassword(initialToken, LEARNER.password, newPassword);
  const token = await loginAs(LEARNER.email, newPassword);

  return {
    email: LEARNER.email,
    password: newPassword,
    token,
    id: res.body.user.id,
  };
}

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await api()
    .post("/api/auth/change-password")
    .set(authHeader(token))
    .send({ currentPassword, newPassword })
    .expect(200);
}

export { ADMIN, LEARNER };
