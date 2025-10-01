import { fetchQuery, fetchMutation } from "convex/nextjs";
import { api } from "../../convex/_generated/api";

export function createConvexAdapter() {
  return {
    id: "convex",
    async create({ model, data }: any) {
      // This will be called by Better Auth to create records
      // We'll handle this in Convex mutations
      return data;
    },
    async findOne({ model, where }: any) {
      // Better Auth will query for users
      return null;
    },
    async findMany({ model, where }: any) {
      return [];
    },
    async update({ model, where, data }: any) {
      return data;
    },
    async delete({ model, where }: any) {
      return true;
    },
  };
}
