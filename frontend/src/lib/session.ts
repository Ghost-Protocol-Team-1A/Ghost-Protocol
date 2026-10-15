import { cookies } from "next/headers";
import { IDENTITY_COOKIE, type Identity, parseIdentity, serializeIdentity } from "./identity";

const EIGHT_HOURS = 60 * 60 * 8;

export async function currentIdentity(): Promise<Identity | null> {
  return parseIdentity((await cookies()).get(IDENTITY_COOKIE)?.value);
}

export async function setIdentity(identity: Identity): Promise<void> {
  (await cookies()).set(IDENTITY_COOKIE, serializeIdentity(identity), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: EIGHT_HOURS,
  });
}

export async function clearIdentity(): Promise<void> {
  (await cookies()).delete(IDENTITY_COOKIE);
}
