module rr_arb(input clk, input rst, input [3:0] req, output reg [3:0] gnt);
  reg [1:0] last; reg [1:0] idx; reg [1:0] gi; reg found; integer i;
  always @* begin
    gnt = 0; found = 0; gi = 0;
    for (i = 1; i <= 4; i = i + 1) begin
      idx = last + i;
      if (!found && req[idx]) begin found = 1; gi = idx; end
    end
    if (found) gnt = 4'b0001 << gi;
  end
  always @(posedge clk) if (rst) last <= 2'd3; 
endmodule
