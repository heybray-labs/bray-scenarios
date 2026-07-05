export const DEMO_PASSWORD = "Demo1234!";

export type DemoUserDef = {
  email: string;
  firstName: string;
  role: "admin" | "user";
};

export const DEMO_ADMIN: DemoUserDef = {
  email: "admin@demo.local",
  firstName: "Admin",
  role: "admin",
};

/** Learners with distinct first names for leaderboard display. */
export const DEMO_LEARNERS: DemoUserDef[] = [
  { email: "sarah.chen@demo.local", firstName: "Sarah", role: "user" },
  { email: "james.wilson@demo.local", firstName: "James", role: "user" },
  { email: "maria.garcia@demo.local", firstName: "Maria", role: "user" },
  { email: "david.kim@demo.local", firstName: "David", role: "user" },
  { email: "emma.thompson@demo.local", firstName: "Emma", role: "user" },
  { email: "michael.brown@demo.local", firstName: "Michael", role: "user" },
  { email: "olivia.martinez@demo.local", firstName: "Olivia", role: "user" },
  { email: "daniel.lee@demo.local", firstName: "Daniel", role: "user" },
  { email: "sophia.anderson@demo.local", firstName: "Sophia", role: "user" },
  { email: "liam.taylor@demo.local", firstName: "Liam", role: "user" },
  { email: "ava.johnson@demo.local", firstName: "Ava", role: "user" },
  { email: "noah.davis@demo.local", firstName: "Noah", role: "user" },
];

export const ALL_DEMO_USERS: DemoUserDef[] = [DEMO_ADMIN, ...DEMO_LEARNERS];

export const DEMO_USER_EMAILS = ALL_DEMO_USERS.map((u) => u.email.toLowerCase());
