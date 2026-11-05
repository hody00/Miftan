export const price = (value: string | null) =>
  value === null
    ? "מחיר לא צוין"
    : new Intl.NumberFormat("he-IL").format(Number(value)) + " ₪";
