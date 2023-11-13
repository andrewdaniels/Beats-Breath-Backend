/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// import * as logger from "firebase-functions/logger";
import * as functions from "firebase-functions";

import { getFirestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";

import { makeFreeGroup, makePaidGroup } from "./groups/data";
import {
  checkUserIsNotExistAndCreate,
  mailerLiteUserCreate,
  mailerLiteUserUpdate,
  updateUserParams,
} from "./mailerlite-user-create.function";

initializeApp();

exports.onCreateUser = functions.firestore
  .document("users/{userId}")
  .onCreate(async (snap, context) => {
    const newValue = snap.data();
    logger.log(newValue);

    const inactiveGroupData = makeFreeGroup();
    const mailerLiteId: string = await mailerLiteUserCreate(
      newValue.email,
      inactiveGroupData
    );
    await getFirestore().collection("users").doc(context.params.userId).update({
      mailerLiteUserId: mailerLiteId,
    });
    logger.log("Function completed");
    return;
  });

exports.onCreatePurchaserInfo = functions.firestore
  .document("users/{userId}/purchaser-info/{purchaserInfoId}")
  .onCreate(async (snap, context) => {
    const newValue = snap.data();
    const userId = context.params.userId;
    await checkUserIsNotExistAndCreate(userId);

    let userDoc = await getFirestore().collection("users").doc(userId).get();
    if (!userDoc.exists) {
      throw new Error("User does not exist");
    }
    const userData = userDoc.data();
    const mailerLiteUserId: string = userData!.mailerLiteUserId;

    const activeSubscriptionName =
      newValue["entitlements"]["Full Access"]["product_plan_identifier"];

    logger.log("activeSubscriptionName", activeSubscriptionName);

    const activeGroups: string[] = makePaidGroup(activeSubscriptionName);
    await mailerLiteUserUpdate(mailerLiteUserId, activeGroups);

    // perform desired operations ...

    // perform desired operations ...
  });

exports.onCreateRevenuecatEvents = functions.firestore
  .document("revenuecat_events/{event_id}")
  .onCreate(async (snap, context) => {
    const newValue = snap.data();

    if (newValue.event_type === "NON_RENEWING_PURCHASE") {
      logger.log("NON_RENEWING_PURCHASE function called");
      const userId = newValue.app_user_id;
      await checkUserIsNotExistAndCreate(userId);

      let userDoc = await getFirestore().collection("users").doc(userId).get();
      if (!userDoc.exists) {
        throw new Error("User does not exist");
      }
      const userData = userDoc.data();
      const mailerLiteUserId: string = userData!.mailerLiteUserId;
      const activeSubscriptionName = newValue.product_id;
      logger.log("activeSubscriptionName", activeSubscriptionName);

      const activeGroups: string[] = makePaidGroup(activeSubscriptionName);
      await mailerLiteUserUpdate(mailerLiteUserId, activeGroups);
      logger.log("NON_RENEWING_PURCHASE function completed");
    }

    if (newValue.event_type === "EXPIRATION") {
      logger.log("EXPIRATION function called");
      const userId = newValue.app_user_id;
      await checkUserIsNotExistAndCreate(userId);

      let userDoc = await getFirestore().collection("users").doc(userId).get();
      if (!userDoc.exists) {
        throw new Error("User does not exist");
      }
      const userData = userDoc.data();
      const mailerLiteUserId: string = userData!.mailerLiteUserId;
      //  const activeSubscriptionName = newValue.product_id;
      //  logger.log("activeSubscriptionName", activeSubscriptionName);
      const inactiveGroupData = makeFreeGroup();

      await mailerLiteUserUpdate(mailerLiteUserId, inactiveGroupData);
      logger.log("EXPIRATION function completed");
    }

    if (newValue.event_type === "TRANSFER") {
      logger.log("TRANSFER function called");
      const transferredFromUserId: string = newValue.transferred_from[0];
      const transferredToUserId: string = newValue.transferred_to[0];

      await checkUserIsNotExistAndCreate(transferredFromUserId);
      await checkUserIsNotExistAndCreate(transferredToUserId);

      // Get transferred from user subscription data
      const subscriptionDoc = await getFirestore()
        .collection("users")
        .doc(transferredFromUserId)
        .collection("purchaser-info")
        .doc(transferredFromUserId)
        .get();
      if (subscriptionDoc.exists) {
        const subscriptionData = subscriptionDoc.data();
        const activeSubscriptionName =
          subscriptionData!["entitlements"]["Full Access"][
            "product_plan_identifier"
          ];
        const activeGroups: string[] = makePaidGroup(activeSubscriptionName);
        await mailerLiteUserUpdate(transferredFromUserId, activeGroups);
      }
      const inactiveGroupData = makeFreeGroup();
      await mailerLiteUserUpdate(transferredFromUserId, inactiveGroupData);
      logger.log("TRANSFER function completed");
    }

    if (newValue.event_type === "PRODUCT_CHANGE") {
      logger.log("PRODUCT_CHANGE function called");
      const userId = newValue.app_user_id;
      await checkUserIsNotExistAndCreate(userId);

      let userDoc = await getFirestore().collection("users").doc(userId).get();
      if (!userDoc.exists) {
        throw new Error("User does not exist");
      }
      const userData = userDoc.data();
      const mailerLiteUserId: string = userData!.mailerLiteUserId;

      const activeSubscriptionName = newValue.new_product_id;
      logger.log("activeSubscriptionName", activeSubscriptionName);
      const activeGroups: string[] = makePaidGroup(activeSubscriptionName);
      await mailerLiteUserUpdate(mailerLiteUserId, activeGroups);
      logger.log("PRODUCT_CHANGE function completed");
    }
  });

exports.migrateInMailerLite = functions
  .runWith({
    // Ensure the function has enough memory and time
    // to process large files
    timeoutSeconds: 540,
  })
  .https.onRequest(async (req, res: functions.Response<string>) => {
    let userDocs = await getFirestore().collection("users").get();
    logger.log("userDocs", userDocs.docs.length);
    logger.log(req.query);
    const iFrom: number = +(req.query.startFrom ?? 0);

    for (let i = iFrom; i < userDocs.docs.length; i++) {
      logger.log(
        "going for user",
        i,
        "of",
        userDocs.docs.length,
        "  ",
        userDocs.docs[i].id
      );
      const userData = userDocs.docs[i].data();
      const emailId = userData.email;
      const userId = userDocs.docs[i].id;
      const inactiveGroupData = makeFreeGroup();
      logger.log("emailId", emailId);
      logger.log("inactiveGroupData", inactiveGroupData);
      const mailerLiteId: string = await mailerLiteUserCreate(
        emailId,
        inactiveGroupData
      );
      await getFirestore().collection("users").doc(userId).update({
        mailerLiteUserId: mailerLiteId,
      });

      // // Create subscriber in mailerlite
      const subscriptionData = await getFirestore()
        .collection("users")
        .doc(userId)
        .collection("purchaser-info")
        .doc(userId)
        .get();

      if (subscriptionData.exists) {
        try {
          const activeSubscriptionName =
            subscriptionData.data()!["entitlements"]["Full Access"][
              "product_plan_identifier"
            ];
          const activeGroups: string[] = makePaidGroup(activeSubscriptionName);
          logger.log("activeGroups", activeGroups);
          await mailerLiteUserUpdate(mailerLiteId, activeGroups);
        } catch (e) {
          logger.log("error", e);
          const activeSubscriptionName =
            subscriptionData.data()!["entitlements"]["Full Access"][
              "product_identifier"
            ];
          const activeGroups: string[] = makePaidGroup(activeSubscriptionName);
          logger.log("activeGroups", activeGroups);
          await mailerLiteUserUpdate(mailerLiteId, activeGroups);
        }
      }
    }
    res.status(200).send(`userDocs, ${userDocs.docs.length}`);
  });

exports.createAffiliatePartners = functions.firestore
  .document("users/{userId}/purchaser-info/{purchaserInfoId}")
  .onCreate(async (snap, context) => {
    const userId = context.params.userId;
    await checkUserIsNotExistAndCreate(userId);

    let userDoc = await getFirestore().collection("users").doc(userId).get();
    const userData = userDoc.data();

    if (!userData?.affiliateCode) {
      logger.log("No affiliate codes");
      logger.log({
        message: "User is not coming throve from affiliate code",
        userId,
      });
      return;
    }
    const affiliatedUser = await getFirestore()
      .collection("users")
      .where("myAffiliateCode", "==", userData.affiliateCode)
      .get();

    if (affiliatedUser.empty) {
      logger.log("No affiliated user found");
      logger.log({
        message: "affiliateCode not found.",
        userId,
        affiliateCode: userData.affiliateCode,
      });
      return;
    }

    const affiliateUserData = affiliatedUser.docs[0].data();
    logger.info(affiliateUserData);
    const affiliatedUserId = affiliatedUser.docs[0].id;

    // create affiliate partner
    await getFirestore()
      .collection("users")
      .doc(affiliatedUserId)
      .collection("affiliate_partners")
      .doc(context.params.userId)
      .set({
        affiliateRef: affiliatedUser.docs[0].ref,
        affiliateCode: userData.affiliateCode,
        createdAt: new Date(),
      });

    // increment count by one
    await affiliatedUser.docs[0].ref.update({
      totalAffiliateAccountCount:
        (affiliateUserData.totalAffiliateAccountCount ?? 0) + 1,
    });
  });

exports.createAndUpdateUserNameInMailerLite = functions.firestore
  .document("users/{userId}")
  .onUpdate(async (change, context) => {
    const userId = context.params.userId;
    const newValue = change.after.data();
    const oldValue = change.before.data();

    // check
    await checkUserIsNotExistAndCreate(userId);

    logger.log("newValue", newValue);
    logger.log("oldValue", oldValue);

    let isChanged = false;
    if (newValue.firstName !== oldValue.firstName) {
      isChanged = true;
    }
    if (newValue.lastName !== oldValue.lastName) {
      isChanged = true;
    }

    if (!isChanged) {
      logger.log("No change in name");
      return;
    }

    let userDoc = await getFirestore().collection("users").doc(userId).get();
    if (!userDoc.exists) {
      throw new Error("User does not exist");
    }
    const userData = userDoc.data();
    const mailerLiteUserId: string = userData!.mailerLiteUserId;

    await updateUserParams(mailerLiteUserId, {
      firstname: newValue.firstName ?? "",
      lastname: newValue.lastName ?? "",
    });
  });

exports.addUserNameInMailerLiteMigration = functions
  .runWith({
    // Ensure the function has enough memory and time
    // to process large files
    timeoutSeconds: 540,
  })
  .https.onRequest(async (req, res: functions.Response<string>) => {
    let userDocs = await getFirestore().collection("users").get();
    logger.log("userDocs", userDocs.docs.length);
    logger.log(req.query);
    const iFrom: number = +(req.query.startFrom ?? 0);
    const endTo: number = +(req.query.endTo ?? userDocs.docs.length);

    const bothNamePresent: string[] = [];
    const firstNamePresent: string[] = [];
    const lastNamePresent: string[] = [];
    const mailerLiteUserIdNotPresent: string[] = [];
    const bothNameNotPresent: string[] = [];

    for (let i = iFrom; i < endTo; i++) {
      logger.log(
        "going for user",
        i,
        "of",
        userDocs.docs.length,
        "  ",
        userDocs.docs[i].id
      );
      const userData = userDocs.docs[i].data();

      if (!userData?.mailerLiteUserId) {
        logger.error(userDocs.docs[i].id, {
          message: "mailerLiteUserId not found",
        });
        mailerLiteUserIdNotPresent.push(userDocs.docs[i].id);
        continue;
      }
      if (userData.firstName && userData.lastName) {
        bothNamePresent.push(userDocs.docs[i].id);
      } else if (userData.firstName) {
        firstNamePresent.push(userDocs.docs[i].id);
      } else if (userData.lastName) {
        lastNamePresent.push(userDocs.docs[i].id);
      } else {
        bothNameNotPresent.push(userDocs.docs[i].id);
      }

      if (userData.firstName || userData.lastName) {
        const mailerLiteUserId: string = userData!.mailerLiteUserId;
        await updateUserParams(mailerLiteUserId, {
          firstname: userData.firstName ?? "",
          lastname: userData.lastName ?? "",
        });
      }
    }
    const outPutData = {
      bothNamePresent,
      firstNamePresent,
      lastNamePresent,
      bothNameNotPresent,
      mailerLiteUserIdNotPresent,
      totalLength: userDocs.docs.length,
      bothNamePresentLength: bothNamePresent.length,
      firstNamePresentLength: firstNamePresent.length,
      lastNamePresentLength: lastNamePresent.length,
      bothNameNotPresentLength: bothNameNotPresent.length,
      mailerLiteUserIdNotPresentLength: mailerLiteUserIdNotPresent.length,
    };
    logger.log(outPutData);
    res.status(200).send(JSON.stringify(outPutData));
    return;
  });
//  "firestore": {
//     "port": 8080
//   },
