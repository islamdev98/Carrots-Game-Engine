exports.sign = async configuration => {
  console.log(
    `Skipping Windows code signing for unsigned local build: ${configuration.path}`
  );
};
