import com.google.gerrit.common.Nullable;
   * @param newGitFileMode the new file mode in octal format. {@code null} indicates no change
      Repository repository,
      ChangeNotes notes,
      String filePath,
      RawInput newContent,
      @Nullable Integer newGitFileMode)
            .addTreeModification(
                new ChangeFileContentModification(filePath, newContent, newGitFileMode))