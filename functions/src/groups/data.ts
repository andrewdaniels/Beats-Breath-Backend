import { MailerGroupsEnums } from "../enums/mailer-groups.enums";
import { MailerGroupsInterface } from "../interface/groups.interface";
import { SubscriptionInterface } from "../interface/subscription.interface";

export function getGroups(): MailerGroupsInterface[] {
  const data: MailerGroupsInterface[] = [
    // {
    //   id: "104096086212215852",
    //   name: MailerGroupsEnums.Free,
    // },
    // {
    //   id: "104096075835507730",
    //   name: MailerGroupsEnums.Lifetime,
    // },
    // {
    //   id: "104096052483721174",
    //   name: MailerGroupsEnums.Monthly,
    // },
    // {
    //   id: "104096067544417983",
    //   name: MailerGroupsEnums.Yearly,
    // },

    // ---------------------------------------
    {
      id: "104197907835520048",
      name: MailerGroupsEnums.Free,
    },
    {
      id: "104197968446359050",
      name: MailerGroupsEnums.Lifetime,
    },
    {
      id: "104197980359230952",
      name: MailerGroupsEnums.Monthly,
    },
    {
      id: "104197996223136934",
      name: MailerGroupsEnums.Yearly,
    },
  ];
  return data;
}

export function getSubscription() {
  const data: SubscriptionInterface[] = [
    {
      name: "bb_annual",
      group: MailerGroupsEnums.Yearly,
    },
    {
      name: "bb_monthly",
      group: MailerGroupsEnums.Monthly,
    },
    {
      name: "bb_lifetime",
      group: MailerGroupsEnums.Lifetime,
    },
    {
      name: "full_access:bb-annual",
      group: MailerGroupsEnums.Yearly,
    },
    {
      name: "full_access:bb-monthly",
      group: MailerGroupsEnums.Monthly,
    },
    {
      name: "bb-annual",
      group: MailerGroupsEnums.Yearly,
    },
    {
      name: "bb-monthly",
      group: MailerGroupsEnums.Monthly,
    },
  ];
  return data;
}

export function getSubscriptionNameBySubscriptionName(
  name: string
): SubscriptionInterface {
  const subscription = getSubscription();
  const subscriptionName: SubscriptionInterface | undefined = subscription.find(
    (subscription) => subscription.name === name
  );
  if (!subscriptionName) {
    throw new Error(`Subscription ${name} not found`);
  }
  return subscriptionName;
}

export function getGroupByName(name: MailerGroupsEnums): MailerGroupsInterface {
  const data = getGroups();
  const group = data.find((group) => group.name === name);
  if (!group) {
    throw new Error(`Group ${name} not found`);
  }
  return group;
}

export function getGroupBySubscriptionName(
  name: string
): MailerGroupsInterface {
  const subscriptionName = getSubscriptionNameBySubscriptionName(name);

  const group = getGroupByName(subscriptionName.group);
  return group;
}

export function makeFreeGroup(): string[] {
  const freeGroup = getGroupByName(MailerGroupsEnums.Free);

  return [freeGroup.id];
}

export function makePaidGroup(subscriptionName: string): string[] {
  const subscription = getGroupBySubscriptionName(subscriptionName);
  return [subscription.id];
}
