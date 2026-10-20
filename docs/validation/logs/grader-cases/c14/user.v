module seq_det(input clk, input rst, input din, output hit);
  reg [3:0] sh;  // last 4 bits; reset to 0000 so pre-reset bits can't match
  always @(posedge clk) if (rst) sh <= 4'b1111; else sh <= {sh[2:0], din};
  assign hit = (sh == 4'b1011);
endmodule
