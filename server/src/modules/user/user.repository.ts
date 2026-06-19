import prisma from "../../core/db";

// Data access for user profiles. Point scoring / ranking math stays in user.service.ts.

export const findUserProfileById = (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      description: true,
      avatarUrl: true,
      createdAt: true,
      alliance: { select: { id: true, name: true, tag: true } },
      cities: {
        select: {
          id: true,
          name: true,
          x: true,
          y: true,
          buildings: { select: { name: true, level: true } },
        },
        orderBy: { name: "asc" },
      },
    },
  });

export const findAllUsersWithBuildings = () =>
  prisma.user.findMany({
    select: {
      id: true,
      cities: { select: { buildings: { select: { name: true, level: true } } } },
    },
  });

export const updateUserDescription = (userId: string, description: string | null) =>
  prisma.user.update({
    where: { id: userId },
    data: { description },
  });
