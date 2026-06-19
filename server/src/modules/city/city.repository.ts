import prisma from "../../core/db";
import { Prisma } from "@prisma/client";

// Routine data access for the city module. Resource math (computeResources) and
// the transactional createStarterCity orchestration stay in city.service.ts.

export const updateCityResources = (
  cityId: string,
  resources: { money: number; energy: number; ammo: number },
) =>
  prisma.city.update({
    where: { id: cityId },
    data: { ...resources, lastResourceUpdate: new Date() },
  });

export const findCityForSync = (cityId: string) =>
  prisma.city.findUnique({
    where: { id: cityId },
    select: { id: true, money: true, energy: true, ammo: true, lastResourceUpdate: true, buildings: { select: { name: true, level: true } } },
  });

export const findCityOverview = (where: Prisma.CityWhereInput) =>
  prisma.city.findFirst({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      buildings:             { orderBy: { name: "asc" } },
      units:                 { orderBy: { name: "asc" } },
      buildingUpgradeOrders: { orderBy: { finishAt: "asc" } },
      recruitmentOrders:     { orderBy: { finishAt: "asc" } },
    },
  });

export const findStationedSupports = (cityId: string) =>
  prisma.command.findMany({
    where:  { toCityId: cityId, type: "SUPPORT", status: "ARRIVED" },
    select: { units: { select: { name: true, quantity: true } } },
  });

export const findOutgoingCommands = (cityId: string) =>
  prisma.command.findMany({
    where:  { fromCityId: cityId, status: { in: ["TRAVELING", "RETURNING", "ARRIVED"] } },
    select: { units: { select: { name: true, quantity: true } } },
  });

export const findOwnedCities = (userId: string) =>
  prisma.city.findMany({
    where:   { ownerId: userId },
    select:  { id: true, name: true, x: true, y: true },
    orderBy: { createdAt: "asc" },
  });

export const findCityIdForOwner = (where: Prisma.CityWhereInput) =>
  prisma.city.findFirst({ where, orderBy: { createdAt: "asc" }, select: { id: true } });

export const updateCityName = (cityId: string, name: string) =>
  prisma.city.update({ where: { id: cityId }, data: { name }, select: { id: true, name: true } });
