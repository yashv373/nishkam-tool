module sync2(input clk_a, input clk_b, input rst_b, input d, output q);
reg s1, s2, k; always @(posedge clk_b) if (rst_b) {s2, s1, k} <= 0; else begin k <= ~k; s1 <= d; s2 <= s1 ^ k; end
  assign q = s2; endmodule
