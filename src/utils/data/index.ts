export const jsonifyObj = (data: any) => {
  let result = '{}';
  try {
    result = JSON.stringify(data);
    return result;
  } catch {
    return result;
  }
};

export const jsonParseObj = (data: any) => {
  let result = {};
  try {
    result = JSON.parse(data);
    return result;
  } catch {
    return result;
  }
};

/**
 * https://stackoverflow.com/a/43260158/8106429
 * input: [1, 2, 3]
 * output: Array
 * 0: (3) [1, 2, 3]
 * 1: (3) [1, 3, 2]
 * 2: (3) [2, 1, 3]
 * 3: (3) [2, 3, 1]
 * 4: (3) [3, 1, 2]
 * 5: (3) [3, 2, 1]
 */
export const getPermutationOfArray = <T = number>(xs: Array<T>) => {
  let ret = [] as Array<Array<T>>;

  for (let i = 0; i < xs.length; i++) {
    let rest = getPermutationOfArray(xs.slice(0, i).concat(xs.slice(i + 1)));

    if(!rest.length) {
      ret.push([xs[i]]);
    } else {
      for(let j = 0; j < rest.length; j++) {
        ret.push([xs[i]].concat(rest[j]));
      }
    }
  }
  return ret;
};
