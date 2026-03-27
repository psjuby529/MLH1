/**
 * Multi 內測頁允許的 dataset_id（與 docs/MIXED_UAT_ALLOWLIST.md 一致）。
 * 排除：zonghe_a、zonghe_b（綜合 A/B）。
 */
export const MULTI_TEST_DATASET_ALLOWLIST = new Set<string>([
  "y105",
  "y106",
  "y107",
  "y108",
  "y109",
  "y110",
  "y111",
  "y112",
  "y113",
  "y90006",
  "y90007",
  "y90008",
  "y90009",
]);

export function isMultiTestAllowedDataset(id: string): boolean {
  return MULTI_TEST_DATASET_ALLOWLIST.has(id);
}
