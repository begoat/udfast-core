export const formatFileSize = (fileBytes: number) => {
  return `${fileBytes}B`;
};

export const numberToInt = (num: number, defaultVal = 0) => {
  return Number.isNaN(num) ? defaultVal : num;
};
