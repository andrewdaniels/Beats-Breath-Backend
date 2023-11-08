import axios from "axios";
import { getFirestore } from "firebase-admin/firestore";
import { makeFreeGroup } from "./groups/data";
import * as logger from "firebase-functions/logger";

export async function mailerLiteUserCreate(
  emailId: string,
  userGroup: string[]
): Promise<string> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.MAILERLITE_TOKEN}`,
    Accept: "application/json",
  };

  const data = await axios.post(
    `https://connect.mailerlite.com/api/subscribers`,
    {
      email: emailId,
      groups: userGroup,
    },
    { headers }
  );
  logger.log(data.status);
  // logger.log(data.data.data);
  if (data.status === 201 || data.status === 200) {
    logger.log({
      mailerLiteId: data.data.data.id,
    });
    return data.data.data.id as string;
  }
  throw new Error("MailerLite user creation failed");
}

export async function mailerLiteUserUpdate(
  mailerLiteUserId: string,
  userGroup: string[]
): Promise<string> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.MAILERLITE_TOKEN}`,
    Accept: "application/json",
  };

  const data = await axios.put(
    `https://connect.mailerlite.com/api/subscribers/${mailerLiteUserId}`,
    {
      groups: userGroup,
    },
    { headers }
  );
  logger.log(data.status);
  logger.log(data.data.data);
  if (data.status === 200) {
    logger.log({
      mailerLiteId: data.data.data.id,
    });
    return data.data.data.id as string;
  }
  throw new Error("MailerLite user creation failed");
}

export async function checkUserIsNotExistAndCreate(userId: string) {
  let userDoc = await getFirestore().collection("users").doc(userId).get();
  if (!userDoc.exists) {
    throw new Error("User does not exist");
  }
  const userData = userDoc.data();
  if (!userData?.mailerLiteUserId) {
    const inactiveGroupData = makeFreeGroup();
    const mailerLiteId: string = await mailerLiteUserCreate(
      userData?.email,
      inactiveGroupData
    );
    await getFirestore().collection("users").doc(userId).update({
      mailerLiteUserId: mailerLiteId,
    });
  }
}
