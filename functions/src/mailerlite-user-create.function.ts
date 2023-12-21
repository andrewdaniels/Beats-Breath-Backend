import axios from "axios";
import { getFirestore } from "firebase-admin/firestore";
import { getGroups, makeFreeGroup } from "./groups/data";
import * as logger from "firebase-functions/logger";
import MailerLite from "@mailerlite/mailerlite-nodejs";

const mailerLite = new MailerLite({
  api_key: process.env.MAILERLITE_TOKEN!,
});
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
): Promise<void> {
  const groups = getGroups();
  logger.debug(groups);

  for (let i = 0; i < groups.length; i++) {
    logger.debug(groups[i].id);

    await mailerLite.groups
      .unAssignSubscriber(mailerLiteUserId, groups[i].id)
      .then((response) => {
        logger.info(response.data);
      })
      .catch((error) => {
        if (error.response) logger.info(error.response.data);
      });
  }
  logger.debug("Going for assign groups");

  for (let i = 0; i < userGroup.length; i++) {
    logger.debug(userGroup[i]);

    await mailerLite.groups
      .assignSubscriber(mailerLiteUserId, userGroup[i])
      .then((response) => {
        logger.info(response.data);
      })
      .catch((error) => {
        if (error.response) logger.info(error.response.data);
      });
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

export async function updateUserParams(
  mailerLiteUserId: string,
  params: Object
) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.MAILERLITE_TOKEN}`,
    Accept: "application/json",
  };

  const data = await axios
    .put(
      `https://connect.mailerlite.com/api/subscribers/${mailerLiteUserId}`,
      {
        fields: {
          ...params,
        },
      },
      { headers }
    )
    .catch(function (error) {
      logger.error(error);
      throw new Error("MailerLite user update failed");
    });
  logger.log(data?.status);
  logger.log(data?.data.data);
  if (data?.status === 200 || data?.status === 201) {
    logger.log({
      mailerLiteId: data.data.data.id,
      fields: data.data.data.fields,
    });
    return {
      mailerLiteId: data.data.data.id as string,
      fields: data.data.data.fields as Object,
    };
  }
  throw new Error("MailerLite user update failed");
}
