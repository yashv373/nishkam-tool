module t(input clk_a, input clk_b, input din, output q);
reg dr; always @(posedge clk_a) dr <= din;
reg s1; always @(posedge clk_b) s1 <= dr;
assign q=s1; endmodule
