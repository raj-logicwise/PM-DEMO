const markdownIt = require("markdown-it");
const md = markdownIt({ html: true });
const fs = require("fs");

module.exports = function (eleventyConfig) {
  // Pass through all static assets unchanged
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("js");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("fonts");
  eleventyConfig.addPassthroughCopy("plugins");
  eleventyConfig.addPassthroughCopy("media");
  eleventyConfig.addPassthroughCopy("downloads");
  eleventyConfig.addPassthroughCopy("third-party");
  eleventyConfig.addPassthroughCopy("layouts");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("CNAME");
  eleventyConfig.addPassthroughCopy("robots.txt");
  eleventyConfig.addPassthroughCopy("sitemap.xml");

  // Pass through all existing root-level HTML files unchanged
  eleventyConfig.addPassthroughCopy("*.html");

  // Readable date filter for templates
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return new Date(dateObj).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });

  // Posts collection — reads each file directly so body is always rendered HTML
  eleventyConfig.addCollection("posts", function (collectionApi) {
    return collectionApi
      .getFilteredByGlob("_posts/*.md")
      .map((post) => {
        const raw = fs.readFileSync(post.inputPath, "utf8");
        // Split on YAML front matter delimiters and take everything after second ---
        const parts = raw.split(/^---[ \t]*$/m);
        const bodyMarkdown = parts.length >= 3 ? parts.slice(2).join("---").trim() : "";
        post.data.renderedBody = md.render(bodyMarkdown);
        return post;
      })
      .sort((a, b) => b.date - a.date);
  });

  return {
    templateFormats: ["md", "njk"],
    markdownTemplateEngine: "njk",
    dir: {
      input: ".",
      output: "_site",
      includes: "layouts",
      data: "_data",
    },
  };
};
