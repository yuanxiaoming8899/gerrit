load("@rules_java//java:defs.bzl", "java_library")

java_library(
    name = "common-test-util",
    testonly = True,
    srcs = glob(["**/*.java"]),
    visibility = ["//visibility:public"],
    deps = [
        "//java/com/google/gerrit/entities",
        "//java/com/google/gerrit/extensions:api",
        "//java/com/google/gerrit/truth",
        "//lib:guava",
        "//lib:jgit",
        "//lib/auto:auto-value",
        "//lib/auto:auto-value-annotations",
        "//lib/truth",
    ],
)
