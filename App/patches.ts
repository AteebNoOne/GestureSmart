const fs = require("fs-extra");
const path = require("path");

const FILE_TO_DELETE = "./node_modules/expo-modules-core/android/build/downloads/boost_1_76_0.tar.gz";
const FILES_TO_MODIFY = [
  { path: "./node_modules/react-native/ReactAndroid/build.gradle" },
  { path: "./node_modules/expo-modules-core/android/build.gradle" },

];
const JAVA_FILE_PATH = "./node_modules/react-native-background-actions/android/src/main/java/com/asterinet/react/bgactions/RNBackgroundActionsTask.java";

const OLD_VERSION_CHECK = "if (android.os.Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {";
const NEW_VERSION_CHECK = "if (android.os.Build.VERSION.SDK_INT >= 34) { // UPSIDE_DOWN_CAKE is API 34";
const OLD_PENDING_INTENT = "PendingIntent.getActivity(context,0, notificationIntent, PendingIntent.FLAG_MUTABLE | PendingIntent.FLAG_ALLOW_UNSAFE_IMPLICIT_INTENT);";
const NEW_PENDING_INTENT = "PendingIntent.getActivity(context,0, notificationIntent, PendingIntent.FLAG_MUTABLE | 0x10000000); // FLAG_ALLOW_UNSAFE_IMPLICIT_INTENT value";


const OLD_URL = `https://boostorg.jfrog.io/artifactory/main/release/\${BOOST_VERSION.replace("_", ".")}/source/boost_\${BOOST_VERSION}.tar.gz`;
const NEW_URL = `https://archives.boost.io/release/\${BOOST_VERSION.replace("_", ".")}/source/boost_\${BOOST_VERSION}.tar.gz`;

const patch = () => {
  // Delete the file
  if (fs.existsSync(FILE_TO_DELETE)) {
    fs.removeSync(FILE_TO_DELETE);
    console.log(`Deleted file: ${FILE_TO_DELETE}`);
  } else {
    console.log(`File not found: ${FILE_TO_DELETE}`);
  }

  FILES_TO_MODIFY.forEach(({ path: filePath }) => {
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf8");
      const updatedContent = fileContent.replace(OLD_URL, NEW_URL);

      if (fileContent !== updatedContent) {
        fs.writeFileSync(filePath, updatedContent, "utf8");
        console.log(`Updated file: ${filePath}`);
      } else {
        console.log(`No changes made in: ${filePath}`);
      }
    } else {
      console.log(`File not found: ${filePath}`);
    }
  });
};

// Modify Java file
if (fs.existsSync(JAVA_FILE_PATH)) {
  let javaContent = fs.readFileSync(JAVA_FILE_PATH, "utf8");
  let updatedJavaContent = javaContent
    .replace(OLD_VERSION_CHECK, NEW_VERSION_CHECK)
    .replace(OLD_PENDING_INTENT, NEW_PENDING_INTENT);

  if (javaContent !== updatedJavaContent) {
    fs.writeFileSync(JAVA_FILE_PATH, updatedJavaContent, "utf8");
    console.log(`Updated Java file: ${JAVA_FILE_PATH}`);
  } else {
    console.log(`No changes made in: ${JAVA_FILE_PATH}`);
  }
} else {
  console.log(`Java file not found: ${JAVA_FILE_PATH}`);
}
patch();
