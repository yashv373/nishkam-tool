export PATH=/opt/or-deps/bin:$PATH
mkdir -p /build && cd /build
cmake /src -DCMAKE_BUILD_TYPE=Release -DBUILD_GUI=OFF -DCMAKE_PREFIX_PATH=/opt/or-deps $(cat /src/deps-prefixes.sh) > /src/cmake.log 2>&1 || { echo CMAKE_FAIL >> /src/build.log; exit 1; }
make -j6 openroad > /src/build.log 2>&1
echo BUILD_EXIT $? >> /src/build.log
cp /build/bin/openroad /src/openroad-native
