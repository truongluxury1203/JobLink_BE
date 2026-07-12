export const toResultOk = ({
  data = null,
  msg = null,
  statusCode = 200,
} = {}) => ({
  statusCode,
  ...(msg && { msg }),
  ...(data && { data }),
  isOk: true,
  isError: false,
});
export const toResultError = ({ statusCode, msg }) => {
  return {
    statusCode: statusCode,
    msg: msg,
    isOk: false,
    isError: true,
  };
};
