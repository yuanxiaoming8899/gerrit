load("//tools/bzl:junit.bzl", "junit_tests")

junit_tests(
    name = "update_tests",
    size = "medium",
    srcs = glob(["*.java"]),
    runtime_deps = [
        "//java/com/google/gerrit/lucene",
        "//prolog:gerrit-prolog-common",
    ],
    deps = [
        "//java/com/google/gerrit/common:annotations",
        "//java/com/google/gerrit/entities",
        "//java/com/google/gerrit/extensions:api",
        "//java/com/google/gerrit/server",
        "//java/com/google/gerrit/server/util/time",
        "//java/com/google/gerrit/testing:gerrit-test-util",
        "//java/com/google/gerrit/testing:test-ref-update-context",
        "//lib:guava",
        "//lib:jgit",
        "//lib:jgit-junit",
        "//lib/guice",
        "//lib/truth",
        "//lib/truth:truth-java8-extension",
    ],
)
