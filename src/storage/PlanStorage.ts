export interface PlanStorage {
  getItem(name: string): string | null;
  setItem(name: string, value: string): void;
  removeItem(name: string): void;
}
export const localPlanStorage: PlanStorage = {
  getItem(name) {
    return localStorage.getItem(name);
  },
  setItem(name, value) {
    localStorage.setItem(name, value);
  },
  removeItem(name) {
    localStorage.removeItem(name);
  },
};
