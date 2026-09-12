import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { makeDocClient, TABLE_NAME } from "./client";
import { userPk } from "./table";

const doc = makeDocClient();
const PROFILE_SK = "PROFILE";

export interface EmergencyContact {
  name: string;
  phone: string;
}

export interface Profile {
  preferredSpecies?: string;
  locale?: string;
  emergencyContact?: EmergencyContact;
}

export async function getProfile(sub: string): Promise<Profile> {
  const res = await doc.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: userPk(sub), SK: PROFILE_SK },
  }));
  if (!res.Item) return {};
  return {
    preferredSpecies: res.Item.preferredSpecies,
    locale: res.Item.locale,
    emergencyContact: res.Item.emergencyContact,
  };
}

export async function putProfile(sub: string, profile: Profile): Promise<Profile> {
  await doc.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: { PK: userPk(sub), SK: PROFILE_SK, type: "profile", ...profile },
  }));
  return profile;
}
